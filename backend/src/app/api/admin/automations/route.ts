import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Écran « Automatisations & IA ».

// Le réglage d'absence a quitté cet écran : c'est une préférence personnelle,
// elle vit avec les autres dans Paramètres (voir /api/admin/me).
export const GET = adminRoute(["PM", "DIR"], async () => {
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

  return { autoRules, drafts, signals, sentCount, ignoredCount, paidInvoices };
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("toggle-rule-mode"), ruleId: z.string().min(1) }),
  z.object({ action: z.literal("send-draft"), draftId: z.string().min(1) }),
  z.object({ action: z.literal("ignore-draft"), draftId: z.string().min(1) }),
]);

export const POST = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  switch (body.action) {
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
