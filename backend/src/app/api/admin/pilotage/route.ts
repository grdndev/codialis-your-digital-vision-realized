import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Écran « Pilotage » — réservé à la direction.
//
// Les bornes du mois viennent de l'écran (comme sur /rh) : c'est lui qui décide
// de quelle période il parle, et le libellé affiché doit correspondre aux
// chiffres renvoyés.

const DEFAULT_MONTHLY_CHARGES = 21400;
const DEFAULT_MONTHLY_REVENUE_TARGET = 45000;

const querySchema = z.object({
  monthStart: z.string().datetime(),
  monthEnd: z.string().datetime(),
});

export const GET = adminRoute(["DIR"], async (_ctx, request) => {
  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    monthStart: params.get("monthStart"),
    monthEnd: params.get("monthEnd"),
  });
  if (!parsed.success) badRequest("Période invalide");
  const monthStart = new Date(parsed.data.monthStart);
  const monthEnd = new Date(parsed.data.monthEnd);

  const [cashItems, teamProfit, projects, deals, decisions, setting, paidThisMonth, overdueInvoices] =
    await Promise.all([
      prisma.cashForecastItem.findMany({ orderBy: [{ id: "asc" }] }),
      prisma.teamProfitSnapshot.findMany({ include: { user: true } }),
      // Concentration client : seuls les projets avec un montant vendu comptent.
      prisma.project.findMany({ where: { soldAmount: { not: null } }, include: { client: true } }),
      prisma.deal.findMany(),
      prisma.decision.findMany({ include: { author: true }, orderBy: { date: "desc" } }),
      prisma.companySetting.findFirst(),
      prisma.invoice.findMany({ where: { status: "PAYEE", paidAt: { gte: monthStart, lt: monthEnd } } }),
      prisma.invoice.findMany({ where: { status: "EN_RETARD" } }),
    ]);

  return {
    cashItems,
    teamProfit,
    projects,
    deals,
    decisions,
    monthlyCharges: setting?.monthlyChargesEUR ?? DEFAULT_MONTHLY_CHARGES,
    monthlyRevenueTarget: setting?.monthlyRevenueTargetEUR ?? DEFAULT_MONTHLY_REVENUE_TARGET,
    paidThisMonth,
    overdueInvoices,
  };
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update-monthly-charges"), value: z.number().min(0) }),
  z.object({ action: z.literal("update-monthly-revenue-target"), value: z.number().positive() }),
  z.object({
    action: z.literal("add-decision"),
    title: z.string().min(1),
    detail: z.string(),
    impact: z.string(),
    tag: z.string(),
  }),
]);

export const POST = adminRoute(["DIR"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  if (body.action === "add-decision") {
    // L'auteur de la décision est la session.
    await prisma.decision.create({
      data: {
        date: new Date(),
        authorId: user.id,
        title: body.title,
        detail: body.detail,
        impact: body.impact,
        tag: body.tag,
      },
    });
    return;
  }

  // Ligne unique de paramètres d'entreprise, créée si le seed ne l'a pas posée.
  const field =
    body.action === "update-monthly-charges" ? "monthlyChargesEUR" : "monthlyRevenueTargetEUR";
  const existing = await prisma.companySetting.findFirst();
  if (existing) {
    await prisma.companySetting.update({
      where: { id: existing.id },
      data: { [field]: body.value },
    });
  } else {
    await prisma.companySetting.create({ data: { [field]: body.value } });
  }
});
