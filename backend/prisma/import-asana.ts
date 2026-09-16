import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import type { Severity, TaskStatus } from "@prisma/client";

// Reprise des projets depuis les exports Asana.
//
//   npx tsx prisma/import-asana.ts Tapix.csv ADD.csv … [--dry-run]
//   npx tsx prisma/import-asana.ts topformation.csv --as="Top formation"
//
// `--as` rattache l'export à un projet existant dont le nom diffère de celui
// que porte le fichier — les exports n'orthographient pas toujours le projet
// comme la base.
//
// Un export par projet. Le fichier porte lui-même le nom du projet (colonne
// `Projects`), le client est créé au même nom s'il n'existe pas encore.
//
// Import à JOUER UNE SEULE FOIS : le schéma n'a pas de colonne pour retenir
// l'identifiant Asana, donc rien ne permet de rapprocher une ligne déjà
// importée. Relancer le script sur la même base créerait des doublons.
// `--dry-run` affiche ce qui serait écrit sans rien toucher.

const DRY = process.argv.includes("--dry-run");
const FILES = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const RENAME = process.argv.find((a) => a.startsWith("--as="))?.slice("--as=".length) ?? null;

const prisma = new PrismaClient();

// --- Lecture CSV ------------------------------------------------------------
//
// Les `Notes` d'Asana contiennent des retours à la ligne À L'INTÉRIEUR des
// guillemets (un cahier des charges entier sur une cellule). On ne peut donc
// pas découper le fichier en lignes avant d'analyser : il faut parcourir le
// texte caractère par caractère en suivant l'état « entre guillemets ».
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        // Un guillemet doublé à l'intérieur d'une cellule vaut un guillemet.
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(cell); cell = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

// Les cinq exports n'ont pas le même en-tête : « heures estimées »,
// « heure estimées », « Heures estimées », et un espace en fin de
// « Heures réelles ». On compare donc sur une forme normalisée.
function normalize(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

function columnFinder(header: string[]) {
  const index = new Map<string, number>();
  header.forEach((h, i) => index.set(normalize(h), i));
  return (...aliases: string[]): number => {
    for (const a of aliases) {
      const i = index.get(normalize(a));
      if (i !== undefined) return i;
    }
    return -1;
  };
}

// --- Correspondances --------------------------------------------------------

// La colonne « Ticket » d'Asana porte l'état d'avancement. Alma ne l'a pas du
// tout, et certaines lignes y portent un nom de section plutôt qu'un état : on
// retombe alors sur la date d'achèvement, qui ne ment pas.
function statusOf(label: string, completedAt: string): TaskStatus {
  switch (normalize(label)) {
    case "cloture": return "TERMINE";
    case "en cours": return "EN_COURS";
    case "a venir": return "A_FAIRE";
    default: return completedAt.trim() ? "TERMINE" : "A_FAIRE";
  }
}

// `Severity` n'a pas de « Critique » : il se range avec les majeurs, c'est le
// cran au-dessus de mineur qui s'en rapproche le plus.
const SEVERITY: Record<string, Severity> = {
  bloquant: "BLOQUANT",
  critique: "MAJEUR",
  majeur: "MAJEUR",
  mineur: "MINEUR",
};

// Une section dit ce que la ligne est vraiment : un lot de travail, une
// remontée, ou un dépôt de documents et d'accès.
//
// À une exception près : Sumvibes a classé huit correctifs dans sa section
// « Documents du projet ». La colonne `Catégorie` les distingue — elle vaut
// « fix » sur ces lignes, « document » ou rien sur les vrais documents. On les
// récupère donc comme tickets plutôt que de les perdre, sans pour autant
// remonter les clés et accès qui peuplent le reste de la section.
type Kind = "epic" | "ticket" | "skip";
function kindOf(section: string, category: string): Kind {
  const s = normalize(section);
  if (!s) return "epic";
  if (s.startsWith("documents")) return normalize(category) === "fix" ? "ticket" : "skip";
  if (s.startsWith("retours") || s.startsWith("bug")) return "ticket";
  return "epic";
}

function num(value: string): number {
  const n = parseFloat((value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function dateOf(value: string): Date | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// --- Lignes normalisées -----------------------------------------------------

type Row = {
  name: string;
  section: string;
  category: string;
  project: string;
  parent: string;
  notes: string;
  comment: string;
  assigneeEmail: string;
  status: TaskStatus;
  severity: Severity | null;
  estHours: number;
  spentHours: number;
  createdAt: Date | null;
  dueAt: Date | null;
};

function readFile(path: string): Row[] {
  const rows = parseCsv(readFileSync(path, "utf8"));
  if (rows.length < 2) throw new Error(`${path} : fichier vide ou illisible`);
  const at = columnFinder(rows[0]);

  const iName = at("Name");
  const iSection = at("Section/Column");
  const iProject = at("Projects");
  const iParent = at("Parent task");
  const iNotes = at("Notes");
  const iComment = at("Commentaires");
  const iEmail = at("Assignee Email");
  const iTicket = at("Ticket");
  const iCompleted = at("Completed At");
  const iCreated = at("Created At");
  const iDue = at("Due Date");
  const iPriority = at("Priorité");
  const iCategory = at("Catégorie");
  const iEst = at("heures estimées", "heure estimées", "Estimated time");
  const iSpent = at("heures réelles", "Actual time");

  if (iName === -1) throw new Error(`${path} : colonne « Name » introuvable`);

  const cell = (r: string[], i: number) => (i === -1 ? "" : (r[i] ?? "").trim());

  return rows.slice(1).map((r) => ({
    name: cell(r, iName),
    section: cell(r, iSection),
    category: cell(r, iCategory),
    project: cell(r, iProject),
    parent: cell(r, iParent),
    notes: cell(r, iNotes),
    comment: cell(r, iComment),
    assigneeEmail: cell(r, iEmail).toLowerCase(),
    status: statusOf(cell(r, iTicket), cell(r, iCompleted)),
    severity: SEVERITY[normalize(cell(r, iPriority))] ?? null,
    estHours: num(cell(r, iEst)),
    spentHours: num(cell(r, iSpent)),
    createdAt: dateOf(cell(r, iCreated)),
    dueAt: dateOf(cell(r, iDue)),
  })).filter((row) => row.name !== "");
}

// Une sous-tâche n'a NI projet NI section : Asana ne les répète pas sur les
// lignes filles. On les hérite de la tâche parente, retrouvée par son nom.
function inherit(rows: Row[]): Row[] {
  const byName = new Map<string, Row>();
  for (const r of rows) if (r.project) byName.set(r.name, r);

  return rows.map((r) => {
    if (r.project) return r;
    const parent = byName.get(r.parent);
    if (!parent) return r;
    return { ...r, project: parent.project, section: r.section || parent.section };
  });
}

// --- Import -----------------------------------------------------------------

async function nextTicketRef(prefix: string, taken: Set<string>): Promise<number> {
  const existing = await prisma.ticket.findMany({
    where: { ref: { startsWith: prefix } },
    select: { ref: true },
  });
  let max = 300;
  for (const ref of [...existing.map((e) => e.ref), ...taken]) {
    if (!ref.startsWith(prefix)) continue;
    const n = parseInt(ref.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

async function main() {
  if (FILES.length === 0) {
    console.error("Usage : npx tsx prisma/import-asana.ts <fichier.csv> […] [--dry-run]");
    process.exit(1);
  }

  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const unknownEmails = new Set<string>();

  for (const file of FILES) {
    const rows = inherit(readFile(file));
    const csvName = rows.find((r) => r.project)?.project ?? "";
    const projectName = RENAME ?? csvName;
    if (!projectName) {
      console.error(`${file} : aucune colonne « Projects » renseignée, ignoré`);
      continue;
    }

    const work = rows.filter((r) => r.project === csvName && kindOf(r.section, r.category) !== "skip");
    const skipped = rows.length - work.length;
    const epicRows = work.filter((r) => kindOf(r.section, r.category) === "epic");
    const ticketRows = work.filter((r) => kindOf(r.section, r.category) === "ticket");

    const renamed = RENAME && RENAME !== csvName ? ` (le fichier dit « ${csvName} »)` : "";
    console.log(`\n=== ${file} → projet « ${projectName} »${renamed} ===`);
    console.log(`  ${rows.length} lignes lues · ${skipped} ignorées (documents, hors projet)`);
    console.log(`  ${epicRows.length} tâches · ${ticketRows.length} tickets`);

    if (DRY) {
      const sections = [...new Set(epicRows.map((r) => r.section || "(sans section)"))];
      console.log(`  lots : ${sections.join(" | ")}`);
      for (const r of work) {
        if (r.assigneeEmail && !userByEmail.has(r.assigneeEmail)) unknownEmails.add(r.assigneeEmail);
      }
      continue;
    }

    const client =
      (await prisma.client.findUnique({ where: { name: projectName }, select: { id: true } })) ??
      (await prisma.client.create({ data: { name: projectName }, select: { id: true } }));

    let project = await prisma.project.findFirst({
      where: { name: projectName, clientId: client.id },
      select: { id: true, initials: true },
    });
    if (!project) {
      project = await prisma.project.create({
        data: {
          clientId: client.id,
          name: projectName,
          initials: initialsOf(projectName),
          group: "DEV",
          phaseLabel: "",
          description: "",
          // Rien de commercial n'est déduit de l'export : les heures vendues et
          // le montant restent à saisir à la main.
          hoursSold: 0,
          hoursSpent: 0,
          progressPct: 0,
          openedAt: rows.map((r) => r.createdAt).filter((d): d is Date => !!d).sort((a, b) => +a - +b)[0] ?? new Date(),
        },
        select: { id: true, initials: true },
      });
    }

    // --- Lots et tâches ---
    const epicIdByTitle = new Map<string, string>();
    let epicOrder = await prisma.epic.count({ where: { projectId: project.id } });
    for (const row of epicRows) {
      const title = row.section || "Sans lot";
      let epicId = epicIdByTitle.get(title);
      if (!epicId) {
        const epic = await prisma.epic.create({
          data: {
            projectId: project.id,
            title,
            estHours: 0,
            order: epicOrder++,
          },
          select: { id: true },
        });
        epicId = epic.id;
        epicIdByTitle.set(title, epicId);
      }

      const assigneeId = userByEmail.get(row.assigneeEmail) ?? null;
      if (row.assigneeEmail && !assigneeId) unknownEmails.add(row.assigneeEmail);

      await prisma.task.create({
        data: {
          epicId,
          title: row.name,
          description: [row.notes, row.comment].filter(Boolean).join("\n\n"),
          status: row.status,
          estHours: row.estHours,
          spentHours: row.spentHours,
          assigneeId,
          dueAt: row.dueAt,
          order: 0,
          ...(row.createdAt ? { createdAt: row.createdAt } : {}),
        },
      });
    }

    // L'estimation d'un lot est la somme de ses tâches : Asana ne la porte pas.
    for (const [title, epicId] of epicIdByTitle) {
      const sum = epicRows
        .filter((r) => (r.section || "Sans lot") === title)
        .reduce((s, r) => s + r.estHours, 0);
      await prisma.epic.update({ where: { id: epicId }, data: { estHours: sum } });
    }

    // --- Tickets ---
    const prefix = `${project.initials}-`;
    let n = await nextTicketRef(prefix, new Set());
    for (const row of ticketRows) {
      const assigneeId = userByEmail.get(row.assigneeEmail) ?? null;
      if (row.assigneeEmail && !assigneeId) unknownEmails.add(row.assigneeEmail);

      await prisma.ticket.create({
        data: {
          ref: `${prefix}${n++}`,
          projectId: project.id,
          type: "BUG",
          severity: row.severity ?? "MINEUR",
          status: row.status,
          title: row.name,
          description: [row.notes, row.comment].filter(Boolean).join("\n\n"),
          steps: "",
          estHours: row.estHours,
          spentHours: row.spentHours,
          assigneeId,
          // « Retours code review » vient de l'équipe, pas du client.
          clientReported: normalize(row.section).startsWith("retours client"),
          ...(row.createdAt ? { createdAt: row.createdAt } : {}),
        },
      });
    }

    // L'avancement affiché est une colonne stockée : sans ce recalcul, le
    // projet importé resterait à 0 % malgré ses tâches terminées.
    const tasks = await prisma.task.findMany({
      where: { epic: { projectId: project.id } },
      select: { status: true },
    });
    if (tasks.length) {
      const done = tasks.filter((t) => t.status === "TERMINE").length;
      await prisma.project.update({
        where: { id: project.id },
        data: { progressPct: Math.round((done / tasks.length) * 100) },
      });
    }

    console.log(`  → ${epicIdByTitle.size} lots créés, avancement recalculé`);
  }

  if (unknownEmails.size) {
    console.log(`\nComptes inconnus (tâches laissées non assignées) : ${[...unknownEmails].join(", ")}`);
  }
  console.log(DRY ? "\n--dry-run : rien n'a été écrit." : "\nImport terminé.");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
