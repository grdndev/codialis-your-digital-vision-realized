import { z } from "zod";
import { adminRoute, badRequest, commaList, parseBody, parseQuery } from "@/lib/admin-api";
import { reprendreFichiersJoints } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { USER_IDENTITY } from "@/lib/user-identity";
import type { Prisma, Role, Severity, TaskStatus, TicketType } from "@prisma/client";
import { maxSuffix, withUniqueRef } from "@/lib/refs";
import { projectScope } from "@/lib/project-access";
import { recomputeProjectProgress } from "@/lib/project-progress";
import { closeSessions, openSession, refreshProjectSpent } from "@/lib/work-sessions";
import { TICKET_ID_DESCRIPTION, withTicketIds } from "@/lib/ticket-ref";

export const dynamic = "force-dynamic";

// Écran « Tickets » — liste filtrable, et toutes les écritures sur un ticket,
// d'où qu'elles viennent (écran Tickets, fiche ticket, fiche projet). Un ticket
// est l'unique unité de travail d'un projet, rattachée à un épic ou non : il
// n'y a plus de « tâche » (CC-365).
//
// La liste des tickets n'est pas cloisonnée : toute l'équipe interne les voit.
// Ce qui l'est, c'est la LISTE DES PROJETS servant de filtres, et seulement
// quand un développeur demande « assigné à moi » — on ouvre alors l'écran pour
// trier son propre travail, et les projets où il n'en a aucun n'y ont pas leur
// place. Le tri est fait ici, pas à l'affichage.

const STATUSES: TaskStatus[] = ["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"];
const SEVERITIES: Severity[] = ["BLOQUANT", "MAJEUR", "MINEUR"];

// Ordres proposés par l'écran (CC-370). La gravité reste le défaut : on ouvre
// l'écran pour voir ce qui presse. Les autres répondent à « qu'est-ce qui
// vient d'arriver », « qu'est-ce qui traîne », « qu'est-ce qui a bougé »,
// « qu'est-ce qui tombe bientôt ».
const TICKET_SORTS = ["gravite", "recents", "anciens", "modifies", "echeance"] as const;

// Chaque filtre accepte PLUSIEURS valeurs, séparées par des virgules : « les
// bloquants et les majeurs », « ces deux projets ». Une seule valeur par
// critère obligeait à repasser la liste autant de fois qu'on voulait de cas.
// Une valeur inconnue est ignorée plutôt que refusée, comme à l'écran.
const querySchema = z.object({
  project: commaList("Identifiants de projets"),
  type: commaList("BUG, DEV"),
  status: commaList("A_FAIRE, EN_COURS, EN_REVUE, TERMINE"),
  severity: commaList("BLOQUANT, MAJEUR, MINEUR"),
  assignee: z
    .string()
    .optional()
    .describe(
      "`me` (mes tickets), `none` (sans assigné), `all` ou absent (tous), ou une liste d'identifiants de comptes séparés par des virgules (`none` y ajoute les tickets sans assigné)",
    ),
  q: z
    .string()
    .optional()
    .describe("Recherche dans la référence, le titre, la description et les étapes"),
  sort: z
    .enum(TICKET_SORTS)
    .optional()
    .describe(
      "Ordre de la liste : `gravite` (défaut : gravité, puis du plus récent au plus ancien), `recents` (créés le plus récemment), `anciens` (créés le plus anciennement), `modifies` (modifiés le plus récemment), `echeance` (échéance la plus proche d'abord, sans échéance à la fin)",
    ),
});

export const GET = adminRoute(
  ["DEV", "PM", "DIR"],
  async ({ user }, request) => {
    const query = parseQuery(querySchema, request);

    const projectFilter = query.project;
    const typeFilter = query.type.filter((t) => t === "BUG" || t === "DEV") as TicketType[];
    const statusFilter = query.status.filter((s) =>
      STATUSES.includes(s as TaskStatus),
    ) as TaskStatus[];
    const severityFilter = query.severity.filter((s) =>
      SEVERITIES.includes(s as Severity),
    ) as Severity[];

    // « Assigné à » vaut `me`, `none` ou `all` sur l'écran : les trois cas
    // s'excluent. `me` est le cas courant — on ouvre l'écran pour voir ce qu'on
    // a à faire — et c'est pour cela que l'écran l'applique par défaut.
    // L'export, lui, désigne des PERSONNES : une liste d'identifiants de
    // comptes, où `none` ajoute les tickets sans assigné.
    const assigneeFilter = query.assignee ?? null;
    const assigneeIds =
      assigneeFilter && !["me", "none", "all"].includes(assigneeFilter)
        ? assigneeFilter
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : [];

    // Recherche libre. Elle porte sur la référence, le titre, la description et
    // les étapes de reproduction : on cherche un ticket soit par son numéro,
    // soit par un mot dont on se souvient. Elle se CROISE avec les filtres, elle
    // ne les remplace pas.
    const recherche = (query.q ?? "").trim();

    const where: Prisma.TicketWhereInput = {};
    if (assigneeFilter === "me") where.assigneeId = user.id;
    else if (assigneeFilter === "none") where.assigneeId = null;
    else if (assigneeIds.length) {
      const ids = assigneeIds.filter((id) => id !== "none");
      where.AND = [
        {
          OR: [
            ...(ids.length ? [{ assigneeId: { in: ids } }] : []),
            ...(assigneeIds.includes("none") ? [{ assigneeId: null }] : []),
          ],
        },
      ];
    }
    if (projectFilter.length) where.projectId = { in: projectFilter };
    if (typeFilter.length) where.type = { in: typeFilter };
    if (statusFilter.length) where.status = { in: statusFilter };
    if (severityFilter.length) where.severity = { in: severityFilter };
    if (recherche) {
      where.OR = [
        { ref: { contains: recherche } },
        { title: { contains: recherche } },
        { description: { contains: recherche } },
        { steps: { contains: recherche } },
      ];
    }

    // « Moi » demandé par un développeur : les filtres de projet se réduisent
    // aux projets où il a du travail assigné (voir project-access.ts).
    const projectsWhere = assigneeFilter === "me" ? await projectScope(user) : {};

    const [projects, tickets, team] = await Promise.all([
      prisma.project.findMany({
        where: projectsWhere,
        include: { client: true },
        orderBy: { name: "asc" },
      }),
      prisma.ticket.findMany({
        where,
        include: {
          project: { include: { client: true } },
          epic: true,
          assignee: USER_IDENTITY,
        },
        orderBy: { createdAt: "desc" },
      }),
      // Pour le traitement en masse : à qui réassigner une sélection.
      prisma.user.findMany({
        where: { role: { in: ["DEV", "PM", "DIR"] } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Tris faits ici et non en SQL : MySQL place les NULL en tête, et Prisma
    // n'expose pas `nulls: "last"` sur ce connecteur. Les tickets sans gravité
    // — les développements — doivent passer après les bugs, et ceux sans
    // échéance après les datés, pas avant. La requête rend déjà les tickets du
    // plus récent au plus ancien, et le tri de JavaScript est stable : à
    // égalité, c'est cet ordre qui départage.
    const RANK: Record<string, number> = { BLOQUANT: 0, MAJEUR: 1, MINEUR: 2 };
    const sort = query.sort ?? "gravite";
    const ranked = [...tickets].sort((a, b) => {
      switch (sort) {
        case "gravite":
          return (a.severity ? RANK[a.severity] : 3) - (b.severity ? RANK[b.severity] : 3);
        case "recents":
          return 0;
        case "anciens":
          return a.createdAt.getTime() - b.createdAt.getTime();
        case "modifies":
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        case "echeance":
          if (!a.dueAt || !b.dueAt) return (a.dueAt ? 0 : 1) - (b.dueAt ? 0 : 1);
          return a.dueAt.getTime() - b.dueAt.getTime();
      }
    });

    return { projects, tickets: ranked, team };
  },
  {
    summary:
      "Liste des tickets (écran Tickets), triée par gravité puis du plus récent au plus ancien, ou selon `sort`. Renvoie `tickets` (avec projet, épic et assigné), `projects` (filtres de projet) et `team` (comptes à qui assigner). Sans filtre, TOUS les tickets de l'agence, clos compris : préciser `assignee` et `status`.",
    query: querySchema,
  },
);


const ticketId = z.string().min(1).describe(TICKET_ID_DESCRIPTION);
const STATUS = z.enum(["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"]);
const DUE_AT = z.string().datetime().nullable();

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    type: z.enum(["BUG", "DEV"]),
    title: z.string().min(1),
    description: z.string(),
    // Les étapes se saisissaient seulement en modification : un bug arrivait
    // donc toujours sans la façon de le reproduire, c'est-à-dire sans ce qui
    // permet de le traiter.
    steps: z.string(),
    projectId: z.string().min(1),
    epicId: z.string().nullable(),
    severity: z.enum(["BLOQUANT", "MAJEUR", "MINEUR"]).nullable(),
    devNature: z.enum(["FRONT", "BACK", "API", "DESIGN"]).nullable(),
    estHours: z.number().min(0).describe("Estimation, en heures décimales"),
    assigneeId: z
      .string()
      .nullable()
      .describe("Compte assigné ; null = la personne qui crée, si elle est développeuse, sinon personne"),
    dueAt: DUE_AT.default(null).describe("Échéance (instant ISO, 09:00Z pour un jour)"),
  }).describe(
    "Crée un ticket. Renvoie sa référence (`ref`). `severity` ne vaut que pour un BUG, `devNature` que pour un DEV. Trois critères d'acceptation par défaut sont posés.",
  ),
  // Le kanban déplace une carte vers une colonne précise : l'enchaînement pas
  // à pas d'`update-status` ne sait pas exprimer ce geste.
  z.object({
    action: z.literal("set-status"),
    ticketId,
    status: STATUS,
  }).describe(
    "Change le statut. EN_COURS lance le chronomètre de l'assigné, tout autre statut l'arrête. TERMINE est réservé à PM et DIR : un développeur s'arrête à EN_REVUE.",
  ),
  // Traitement en masse : trier vingt tickets un par un pour leur poser le
  // même statut ou le même assigné coûte vingt allers-retours. `null` sur un
  // champ signifie « ne pas y toucher », et non « vider ».
  z.object({
    action: z.literal("bulk-update"),
    ticketIds: z.array(z.string().min(1)).min(1).max(200).describe("Identifiants ou références"),
    status: STATUS.nullable().describe("null = statut inchangé"),
    assigneeId: z.string().nullable().describe("null = assigné inchangé"),
    clearAssignee: z.boolean().describe("true = retirer l'assigné"),
  }).describe("Même statut et/ou même assigné pour plusieurs tickets (200 au plus)."),
  // Tous les champs sauf `ticketId` sont facultatifs : un champ ABSENT reste
  // tel quel, `null` le vide. L'écran envoie toujours tout ; un script ou un
  // agent qui ne veut changer que le titre n'a pas à relire puis renvoyer le
  // reste du ticket.
  z.object({
    action: z.literal("update"),
    ticketId,
    projectId: z.string().min(1).optional().describe("Changer de projet change la référence du ticket"),
    type: z.enum(["BUG", "DEV"]).optional(),
    title: z.string().min(1).max(300).optional(),
    description: z.string().optional(),
    steps: z.string().optional(),
    severity: z.enum(["BLOQUANT", "MAJEUR", "MINEUR"]).nullable().optional(),
    devNature: z.enum(["FRONT", "BACK", "API", "DESIGN"]).nullable().optional(),
    estHours: z.number().min(0).optional(),
    assigneeId: z.string().nullable().optional(),
    epicId: z.string().nullable().optional(),
    dueAt: DUE_AT.optional(),
  }).describe(
    "Modifie un ticket : seuls les champs présents changent, `null` vide un champ. Renvoie `ref` (nouvelle si le projet change) et `previousRef`. Changer l'assigné d'un ticket EN_COURS arrête son chronomètre et le repasse à A_FAIRE.",
  ),
  z.object({
    action: z.literal("toggle-criterion"),
    criterionId: z.string().min(1),
  }).describe("Coche ou décoche un critère d'acceptation."),
  // Les critères ne savaient que se cocher : la liste posée à la création était
  // définitive, alors que c'est justement ce qu'on affine en cours de route.
  z.object({
    action: z.literal("add-criterion"),
    ticketId,
    label: z.string().min(1).max(300),
  }).describe("Ajoute un critère d'acceptation."),
  z.object({
    action: z.literal("update-criterion"),
    criterionId: z.string().min(1),
    label: z.string().min(1).max(300),
  }).describe("Renomme un critère d'acceptation."),
  z.object({ action: z.literal("delete-criterion"), criterionId: z.string().min(1) }).describe(
    "Supprime un critère d'acceptation.",
  ),
  z.object({ action: z.literal("delete"), ticketId }).describe(
    "Supprime un ticket, ses critères, commentaires et pièces jointes ; ses saisies de temps restent au projet.",
  ),
  z.object({
    action: z.literal("add-comment"),
    ticketId,
    body: z.string().min(1).describe("Texte brut, retours à la ligne conservés"),
  }).describe("Ajoute un commentaire au nom du compte appelant."),
]);

// Un épic appartient à un projet : un ticket ne se range que dans un épic de
// SON projet, sans quoi il apparaîtrait sous un épic d'ailleurs.
async function checkEpic(epicId: string | null, projectId: string) {
  if (!epicId) return;
  const epic = await prisma.epic.findUnique({ where: { id: epicId }, select: { projectId: true } });
  if (!epic || epic.projectId !== projectId) badRequest("Cet épic n'appartient pas au projet");
}

// « En cours » lance le chronomètre au nom de l'assigné, tout autre statut
// l'arrête. Le temps se mesure à partir des changements de statut : personne
// n'a à le saisir.
async function applyTicketStatus(
  ticket: { id: string; ref: string; assigneeId: string | null; status: TaskStatus },
  nextStatus: TaskStatus,
  actor: { id: string; role: Role },
): Promise<{ ok: true; ref: string; notice?: string }> {
  // Clôturer, c'est constater que le travail est bon. Ce n'est pas à qui l'a
  // fait de le dire : un développeur va jusqu'à « En revue », la chefferie de
  // projet et la direction ferment.
  if (nextStatus === "TERMINE" && actor.role === "DEV") {
    badRequest("La clôture revient à la chefferie de projet ou à la direction.");
  }

  if (nextStatus === ticket.status) return { ok: true, ref: ticket.ref };

  let notice: string | undefined;
  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticket.id }, data: { status: nextStatus } });
    if (nextStatus !== "EN_COURS") {
      await closeSessions(tx, { ticketId: ticket.id });
      return;
    }
    const started = await openSession(tx, { ticketId: ticket.id }, ticket.assigneeId, actor.id);
    if (!started) notice = "Aucun assigné : le temps ne sera décompté pour personne.";
    else if (ticket.assigneeId !== actor.id)
      notice = "Le temps sera décompté pour l'utilisateur assigné.";
  });
  return { ok: true, ref: ticket.ref, notice };
}

export const POST = adminRoute(
  ["DEV", "PM", "DIR"],
  async ({ user }, request) => {
    const body = await withTicketIds(await parseBody(bodySchema, request));

    switch (body.action) {
      case "create": {
        const project = await prisma.project.findUnique({
          where: { id: body.projectId },
        });
        if (!project) badRequest("Projet introuvable");
        await checkEpic(body.epicId, project.id);
        const prefix = `${project.initials}-`;
        // Les références sont numérotées par projet, à la suite de la plus
        // haute déjà attribuée sur ce préfixe.
        const nextRef = async () => {
          const refs = await prisma.ticket.findMany({
            where: { ref: { startsWith: prefix } },
            select: { ref: true },
          });
          return `${prefix}${
            (maxSuffix(
              refs.map((r) => r.ref),
              prefix,
            ) ?? 300) + 1
          }`;
        };

        const ticket = await withUniqueRef(nextRef, (ref) =>
          prisma.ticket.create({
            data: {
              ref,
              steps: body.steps,
              projectId: body.projectId,
              epicId: body.epicId,
              type: body.type,
              // La gravité ne concerne qu'un bug, la nature qu'un développement.
              severity: body.type === "BUG" ? body.severity : null,
              devNature: body.type === "DEV" ? body.devNature : null,
              title: body.title,
              description: body.description,
              estHours: body.estHours,
              dueAt: body.dueAt ? new Date(body.dueAt) : null,
              // Un développeur qui crée un ticket sans désigner personne se
              // l'attribue : c'est le cas courant.
              assigneeId:
                body.assigneeId ?? (user.role === "DEV" ? user.id : null),
              creatorId: user.id,
              // Critères d'acceptation de départ, adaptés au type de ticket.
              criteria: {
                create: [
                  {
                    label:
                      body.type === "BUG"
                        ? "Le comportement signalé ne se reproduit plus"
                        : "La fonctionnalité correspond à la description",
                    order: 0,
                  },
                  { label: "Testé en préprod", order: 1 },
                  {
                    label:
                      body.type === "BUG"
                        ? "Pas de régression identifiée"
                        : "Validé par le chef de projet",
                    order: 2,
                  },
                ],
              },
            },
          }),
        );
        // L'avancement du projet se lit sur tous ses tickets : un de plus le
        // fait bouger.
        await recomputeProjectProgress(project.id);
        // La référence sert au frontend pour rediriger vers le ticket créé.
        return { ok: true, ref: ticket.ref };
      }

      case "set-status": {
        const ticket = await prisma.ticket.findUnique({ where: { id: body.ticketId } });
        if (!ticket) badRequest("Ticket introuvable");
        const result = await applyTicketStatus(ticket, body.status, user);
        await recomputeProjectProgress(ticket.projectId);
        return result;
      }

      case "bulk-update": {
        if (!body.status && !body.assigneeId && !body.clearAssignee) {
          badRequest("Aucune modification demandée");
        }
        const tickets = await prisma.ticket.findMany({ where: { id: { in: body.ticketIds } } });
        if (!tickets.length) badRequest("Aucun ticket sélectionné");

        // L'assigné se pose d'abord : changer de porteur arrête le chronomètre
        // du précédent et le ticket revient à « À faire », puis le statut
        // demandé s'applique par-dessus. Le retour à « À faire » vaut même
        // quand on redemande « En cours » : sans lui, le statut était déjà le
        // bon et le chronomètre du nouvel assigné ne partait jamais.
        if (body.assigneeId || body.clearAssignee) {
          const nextAssignee = body.clearAssignee ? null : body.assigneeId;
          for (const ticket of tickets) {
            if (ticket.assigneeId === nextAssignee) continue;
            if (ticket.status === "EN_COURS") {
              await prisma.$transaction((tx) => closeSessions(tx, { ticketId: ticket.id }));
            }
            await prisma.ticket.update({
              where: { id: ticket.id },
              data: {
                assigneeId: nextAssignee,
                ...(ticket.status === "EN_COURS" ? { status: "A_FAIRE" as TaskStatus } : {}),
              },
            });
          }
        }

        // Les avertissements (temps compté pour un autre, ticket sans assigné)
        // remontent une fois chacun, pour toute la sélection.
        const notices = new Set<string>();
        if (body.status) {
          const fresh = await prisma.ticket.findMany({ where: { id: { in: body.ticketIds } } });
          for (const ticket of fresh) {
            const { notice } = await applyTicketStatus(ticket, body.status, user);
            if (notice) notices.add(notice);
          }
        }
        for (const projectId of new Set(tickets.map((t) => t.projectId))) {
          await recomputeProjectProgress(projectId);
        }
        return { ok: true, count: tickets.length, notice: [...notices].join(" ") || undefined };
      }

      case "update": {
        const ticket = await prisma.ticket.findUnique({
          where: { id: body.ticketId },
          select: {
            ref: true,
            projectId: true,
            status: true,
            assigneeId: true,
            type: true,
            title: true,
            description: true,
            steps: true,
            severity: true,
            devNature: true,
            estHours: true,
            epicId: true,
            dueAt: true,
          },
        });
        if (!ticket) badRequest("Ticket introuvable");

        // Un champ absent garde sa valeur : on part du ticket tel qu'il est.
        const keep = <K extends keyof typeof ticket>(key: K, value: (typeof ticket)[K] | undefined) =>
          value === undefined ? ticket[key] : value;
        const next = {
          projectId: keep("projectId", body.projectId),
          type: keep("type", body.type),
          title: keep("title", body.title),
          description: keep("description", body.description),
          steps: keep("steps", body.steps),
          severity: keep("severity", body.severity),
          devNature: keep("devNature", body.devNature),
          estHours: keep("estHours", body.estHours),
          assigneeId: keep("assigneeId", body.assigneeId),
          epicId: keep("epicId", body.epicId),
          dueAt: body.dueAt === undefined ? ticket.dueAt : body.dueAt ? new Date(body.dueAt) : null,
        };

        const movedProject = next.projectId !== ticket.projectId;
        // Passer la main pendant que le chronomètre tourne l'arrête pour le
        // précédent assigné, et le ticket revient à « À faire » : au suivant de
        // le démarrer.
        const handover = ticket.status === "EN_COURS" && ticket.assigneeId !== next.assigneeId;
        // Déplacer un ticket lui donne une nouvelle référence, au préfixe du
        // projet d'accueil : une référence porte le projet, en garder une qui
        // désigne l'ancien induirait en erreur à chaque lecture. Le numéro
        // reprend au-delà du plus grand déjà attribué sur ce préfixe.
        let nextRef = ticket.ref;
        if (movedProject) {
          const target = await prisma.project.findUnique({
            where: { id: next.projectId },
            select: { id: true, initials: true },
          });
          if (!target) badRequest("Projet introuvable");

          const prefix = `${target.initials}-`;
          const refs = await prisma.ticket.findMany({
            where: { ref: { startsWith: prefix } },
            select: { ref: true },
          });
          nextRef = `${prefix}${(maxSuffix(refs.map((r) => r.ref), prefix) ?? 300) + 1}`;
        }

        if (!movedProject) await checkEpic(next.epicId, ticket.projectId);
        if (handover) await prisma.$transaction((tx) => closeSessions(tx, { ticketId: body.ticketId }));
        await prisma.ticket.update({
          where: { id: body.ticketId },
          data: {
            ...(handover ? { status: "A_FAIRE" as TaskStatus } : {}),
            ref: nextRef,
            projectId: next.projectId,
            // Un lot appartient à un projet : le changer de projet rend le
            // rattachement caduc.
            epicId: movedProject ? null : next.epicId,
            type: next.type,
            title: next.title,
            description: next.description,
            steps: next.steps,
            // La gravité ne concerne qu'un bug, la nature qu'un développement :
            // on efface celle qui ne correspond plus au type retenu.
            severity: next.type === "BUG" ? next.severity : null,
            devNature: next.type === "DEV" ? next.devNature : null,
            estHours: next.estHours,
            assigneeId: next.assigneeId,
            dueAt: next.dueAt,
          },
        });
        // Changer de projet emporte le ticket — et son temps passé — d'un
        // projet à l'autre : les deux avancements et les deux compteurs
        // d'heures suivent.
        await recomputeProjectProgress(next.projectId);
        if (movedProject) {
          await recomputeProjectProgress(ticket.projectId);
          await prisma.$transaction(async (tx) => {
            await refreshProjectSpent(tx, ticket.projectId);
            await refreshProjectSpent(tx, next.projectId);
          });
        }
        // La référence renvoyée est la NOUVELLE : le frontend s'en sert pour
        // revalider et rediriger, l'ancienne adresse n'existe plus.
        return {
          ok: true,
          ref: nextRef,
          previousRef: ticket.ref,
          notice: handover
            ? "Le temps en cours a été arrêté pour l'assigné précédent, le ticket est repassé à « À faire »."
            : undefined,
        };
      }

      case "toggle-criterion": {
        // Bascule lue en base : deux clics concurrents ne se contredisent pas.
        const criterion = await prisma.ticketCriterion.findUnique({
          where: { id: body.criterionId },
        });
        if (!criterion) badRequest("Critère introuvable");
        await prisma.ticketCriterion.update({
          where: { id: body.criterionId },
          data: { done: !criterion.done },
        });
        return;
      }

      case "delete": {
        // Critères, commentaires et pièces jointes tombent en cascade (schéma).
        // Les saisies de temps, elles, ne tombent PAS : `TimeEntry.ticketId` est
        // une relation facultative, les heures déjà passées restent au projet.
        // Elles perdent seulement leur rattachement au ticket, ce qui est juste
        // — le travail a bien eu lieu.
        const ticket = await prisma.ticket.findUnique({
          where: { id: body.ticketId },
          select: { ref: true, projectId: true },
        });
        if (!ticket) badRequest("Ticket introuvable");
        await prisma.timeEntry.updateMany({
          where: { ticketId: body.ticketId },
          data: { ticketId: null },
        });
        const pieces = await prisma.ticketAttachment.findMany({
          where: { ticketId: body.ticketId },
          select: { fileId: true },
        });
        await prisma.ticket.delete({ where: { id: body.ticketId } });
        // Après la base : la cascade a emporté les lignes, à nous de reprendre
        // les fichiers qu'elles désignaient.
        await reprendreFichiersJoints(pieces.map((p) => p.fileId));
        // Ses sessions sont parties avec lui : le projet perd ce temps mesuré
        // et ce ticket de son avancement.
        await recomputeProjectProgress(ticket.projectId);
        await prisma.$transaction((tx) => refreshProjectSpent(tx, ticket.projectId));
        return { ok: true, ref: ticket.ref };
      }

      case "add-criterion": {
        const ticket = await prisma.ticket.findUnique({
          where: { id: body.ticketId },
          select: { ref: true },
        });
        if (!ticket) badRequest("Ticket introuvable");
        const count = await prisma.ticketCriterion.count({ where: { ticketId: body.ticketId } });
        await prisma.ticketCriterion.create({
          data: { ticketId: body.ticketId, label: body.label.trim(), order: count },
        });
        return { ok: true, ref: ticket.ref };
      }

      case "update-criterion": {
        const criterion = await prisma.ticketCriterion.update({
          where: { id: body.criterionId },
          data: { label: body.label.trim() },
          select: { ticket: { select: { ref: true } } },
        });
        return { ok: true, ref: criterion.ticket.ref };
      }

      case "delete-criterion": {
        const criterion = await prisma.ticketCriterion.findUnique({
          where: { id: body.criterionId },
          select: { ticket: { select: { ref: true } } },
        });
        if (!criterion) badRequest("Critère introuvable");
        await prisma.ticketCriterion.delete({ where: { id: body.criterionId } });
        return { ok: true, ref: criterion.ticket.ref };
      }

      case "add-comment":
        // L'auteur est la session.
        await prisma.ticketComment.create({
          data: { ticketId: body.ticketId, authorId: user.id, body: body.body },
        });
        return;
    }
  },
  {
    summary:
      "Toutes les écritures sur un ticket, d'où qu'elles viennent (écran Tickets, fiche ticket, fiche projet). Un ticket se désigne par son identifiant ou par sa référence.",
    body: bodySchema,
  },
);
