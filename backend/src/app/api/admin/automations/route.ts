import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Écran « Automatisations & IA ».

export const GET = adminRoute(["PM", "DIR"], async ({ user }) => {
  // Le réglage d'absence est propre à la cheffe de projet connectée. Pour une
  // directrice, qui n'en a pas, on retombe sur le premier enregistré : l'écran
  // montre alors un état réel de l'équipe plutôt qu'un panneau vide.
  const absence =
    (await prisma.absenceSetting.findUnique({ where: { pmId: user.id } })) ??
    (await prisma.absenceSetting.findFirst());

  const [autoRules, drafts, signals, sentCount, ignoredCount, paidInvoices] = await Promise.all([
    prisma.automationRule.findMany({ orderBy: { order: "asc" } }),
    prisma.automationDraft.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    prisma.automationSignal.findMany({ orderBy: { order: "asc" } }),
    prisma.automationDraft.count({ where: { status: "SENT" } }),
    prisma.automationDraft.count({ where: { status: "IGNORED" } }),
    // Seules les factures payées ET échues portent un délai de paiement.
    prisma.invoice.findMany({
      where: { status: "PAYEE", paidAt: { not: null }, dueAt: { not: null } },
      select: { id: true, paidAt: true, dueAt: true },
    }),
  ]);

  return { absence, autoRules, drafts, signals, sentCount, ignoredCount, paidInvoices };
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set-absence-mode"),
    mode: z.enum(["OUVERT", "HORAIRES", "CONGES"]),
  }),
  z.object({ action: z.literal("toggle-absence-enabled"), pmId: z.string().min(1) }),
  z.object({ action: z.literal("toggle-rule-mode"), ruleId: z.string().min(1) }),
  z.object({ action: z.literal("send-draft"), draftId: z.string().min(1) }),
  z.object({ action: z.literal("ignore-draft"), draftId: z.string().min(1) }),
]);

export const POST = adminRoute(["PM", "DIR"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  switch (body.action) {
    case "set-absence-mode": {
      // On ne règle que sa propre absence : la clé vient de la session.
      const enabled = body.mode !== "OUVERT";
      await prisma.absenceSetting.upsert({
        where: { pmId: user.id },
        update: { mode: body.mode, enabled },
        create: { pmId: user.id, mode: body.mode, enabled },
      });
      return;
    }

    case "toggle-absence-enabled": {
      // Bascule lue en base : deux clics concurrents ne peuvent pas se croiser.
      const current = await prisma.absenceSetting.findUnique({ where: { pmId: body.pmId } });
      if (!current) badRequest("Réglage introuvable");
      await prisma.absenceSetting.update({
        where: { pmId: body.pmId },
        data: { enabled: !current.enabled },
      });
      return;
    }

    case "toggle-rule-mode": {
      const rule = await prisma.automationRule.findUnique({ where: { id: body.ruleId } });
      if (!rule) badRequest("Règle introuvable");
      await prisma.automationRule.update({
        where: { id: body.ruleId },
        data: { mode: rule.mode === "AUTO" ? "TO_VALIDATE" : "AUTO" },
      });
      return;
    }

    case "send-draft":
      await prisma.automationDraft.update({
        where: { id: body.draftId },
        data: { status: "SENT" },
      });
      return;

    case "ignore-draft":
      await prisma.automationDraft.update({
        where: { id: body.draftId },
        data: { status: "IGNORED" },
      });
      return;
  }
});
