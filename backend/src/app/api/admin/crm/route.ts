import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import type { DealStage } from "@prisma/client";

export const dynamic = "force-dynamic";

// Écran « Prospection commerciale ».

// Une affaire qui change d'étape hérite de la probabilité et de la prochaine
// action de cette étape : ce barème est une règle métier, elle appartient donc
// au backend et non au bouton qui la déclenche.
const STAGE_PROB: Record<DealStage, number> = {
  CONTACT: 10,
  QUALIFIE: 30,
  DEVIS: 50,
  NEGOCIATION: 75,
  SIGNE: 100,
  REFUSE: 0,
};
const STAGE_NEXT: Record<DealStage, string> = {
  CONTACT: "Premier appel à planifier",
  QUALIFIE: "Atelier de cadrage",
  DEVIS: "Devis à envoyer",
  NEGOCIATION: "Relancer la décision",
  SIGNE: "Démarrage à planifier",
  REFUSE: "Motif de refus à saisir",
};

const DEFAULT_QUARTERLY_TARGET = 130000;

export const GET = adminRoute(["PM", "DIR"], async () => {
  const [deals, setting] = await Promise.all([
    prisma.deal.findMany({
      include: { notes: { include: { author: true }, orderBy: { createdAt: "desc" } } },
      orderBy: { order: "asc" },
    }),
    prisma.companySetting.findFirst(),
  ]);
  return { deals, quarterlyTarget: setting?.quarterlyTargetEUR ?? DEFAULT_QUARTERLY_TARGET };
});

const stageEnum = z.enum(["CONTACT", "QUALIFIE", "DEVIS", "NEGOCIATION", "SIGNE", "REFUSE"]);

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("move"), dealId: z.string().min(1), stage: stageEnum }),
  z.object({
    action: z.literal("update"),
    dealId: z.string().min(1),
    contactFirst: z.string().nullable(),
    contactLast: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
    description: z.string(),
    devHours: z.number().nullable(),
    hourlyRate: z.number().nullable(),
  }),
  z.object({
    action: z.literal("set-loss-reason"),
    dealId: z.string().min(1),
    lossReason: z.string().nullable(),
    lossDetail: z.string().nullable(),
  }),
  z.object({ action: z.literal("add-note"), dealId: z.string().min(1), body: z.string().min(1) }),
  z.object({ action: z.literal("update-quarterly-target"), value: z.number().positive() }),
  z.object({
    action: z.literal("create"),
    name: z.string().min(1),
    // Le formulaire saisit des k€ ; le stockage est en euros.
    amountK: z.number(),
    note: z.string(),
  }),
  z.object({ action: z.literal("import-csv"), csv: z.string() }),
]);

// Analyseur CSV minimal : gère les champs entre guillemets contenant une virgule
// et les guillemets échappés (""), qu'un simple split(",") découperait de travers.
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells;
}

export const POST = adminRoute(["PM", "DIR"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  switch (body.action) {
    case "move":
      await prisma.deal.update({
        where: { id: body.dealId },
        data: {
          stage: body.stage,
          probabilityPct: STAGE_PROB[body.stage],
          nextAction: STAGE_NEXT[body.stage],
          // Sortir de « refusé » efface la date de perte : elle ne décrirait
          // plus rien.
          lostAt: body.stage === "REFUSE" ? new Date() : null,
        },
      });
      return;

    case "update":
      await prisma.deal.update({
        where: { id: body.dealId },
        data: {
          contactFirst: body.contactFirst,
          contactLast: body.contactLast,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
          description: body.description,
          devHours: body.devHours,
          hourlyRate: body.hourlyRate,
        },
      });
      return;

    case "set-loss-reason":
      await prisma.deal.update({
        where: { id: body.dealId },
        data: { lossReason: body.lossReason, lossDetail: body.lossDetail },
      });
      return;

    case "add-note":
      // L'auteur de la note est la session, pas un identifiant posté.
      await prisma.dealNote.create({
        data: { dealId: body.dealId, authorId: user.id, body: body.body },
      });
      return;

    case "update-quarterly-target": {
      // Ligne unique de paramètres : on la crée si le seed ne l'a pas posée.
      const existing = await prisma.companySetting.findFirst();
      if (existing) {
        await prisma.companySetting.update({
          where: { id: existing.id },
          data: { quarterlyTargetEUR: body.value },
        });
      } else {
        await prisma.companySetting.create({ data: { quarterlyTargetEUR: body.value } });
      }
      return;
    }

    case "create": {
      const count = await prisma.deal.count({ where: { stage: "CONTACT" } });
      await prisma.deal.create({
        data: {
          name: body.name,
          stage: "CONTACT",
          amount: body.amountK * 1000,
          order: count,
          note: body.note,
          probabilityPct: STAGE_PROB.CONTACT,
          nextAction: STAGE_NEXT.CONTACT,
        },
      });
      return;
    }

    case "import-csv": {
      // En-tête attendu (ordre libre) : nom, montant, note, email, telephone,
      // source. Seul « nom » est obligatoire. Chaque prospect importé arrive en
      // Contact, exactement comme un prospect saisi à la main.
      const lines = body.csv.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) return { error: "empty" as const };

      const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
      const iName = header.indexOf("nom");
      // Sans colonne « nom », le fichier est refusé en entier plutôt que
      // d'importer des lignes anonymes.
      if (iName === -1) return { error: "header" as const };

      const iAmount = header.indexOf("montant");
      const iNote = header.indexOf("note");
      const iEmail = header.indexOf("email");
      const iPhone = header.indexOf("telephone");
      const iSource = header.indexOf("source");

      let order = await prisma.deal.count({ where: { stage: "CONTACT" } });
      let imported = 0;
      let skipped = 0;

      for (const line of lines.slice(1)) {
        const cells = parseCsvLine(line);
        const name = (cells[iName] ?? "").trim();
        // Une ligne sans nom est ignorée, pas fatale : le reste du fichier passe.
        if (!name) {
          skipped++;
          continue;
        }
        const rawAmount = iAmount !== -1 ? parseFloat((cells[iAmount] ?? "").replace(",", ".")) : 0;
        const cell = (i: number) => (i !== -1 ? (cells[i] ?? "").trim() || null : null);

        await prisma.deal.create({
          data: {
            name,
            stage: "CONTACT",
            // La colonne « montant » est en k€, comme la saisie manuelle.
            amount: (Number.isFinite(rawAmount) ? rawAmount : 0) * 1000,
            order: order++,
            note: iNote !== -1 ? (cells[iNote] ?? "").trim() : "",
            probabilityPct: STAGE_PROB.CONTACT,
            nextAction: STAGE_NEXT.CONTACT,
            contactEmail: cell(iEmail),
            contactPhone: cell(iPhone),
            source: cell(iSource),
          },
        });
        imported++;
      }

      return { imported, skipped };
    }
  }
});
