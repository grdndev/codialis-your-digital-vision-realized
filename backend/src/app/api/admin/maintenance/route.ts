import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Écran « Maintenance & garantie ».

// Un projet est « sous garantie » s'il porte une date de fin de garantie
// (CC-351), ou, faute de date, s'il est dans la phase Garantie — les projets
// d'avant la date n'en ont pas. Même logique pour la maintenance, dont les
// projets sans contrat forment leur propre liste : un contrat dit ce qui est
// vendu, la date dit jusqu'à quand on est engagé.
export const GET = adminRoute(["PM", "DIR"], async () => {
  const [warranty, contracts, maintained] = await Promise.all([
    prisma.project.findMany({
      where: { group: { not: "CLO" }, OR: [{ group: "WAR" }, { warrantyEndsAt: { not: null } }] },
      include: { client: true },
    }),
    prisma.maintenanceContract.findMany({ include: { project: { include: { client: true } } } }),
    prisma.project.findMany({
      where: {
        group: { not: "CLO" },
        maintenanceContract: null,
        OR: [{ group: "MAI" }, { maintenanceEndsAt: { not: null } }],
      },
      include: { client: true },
    }),
  ]);
  // Tri sur l'échéance réelle de la garantie, la plus proche d'abord ; les
  // projets sans aucune date passent à la fin. Fait ici et non en SQL, qui
  // mettrait les NULL en tête (TRAP-002).
  const warrantyEnd = (p: (typeof warranty)[number]) =>
    (p.warrantyEndsAt ?? p.deadlineAt)?.getTime() ?? Number.POSITIVE_INFINITY;
  const maintenanceEnd = (p: (typeof maintained)[number]) =>
    p.maintenanceEndsAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return {
    warranty: [...warranty].sort((a, b) => warrantyEnd(a) - warrantyEnd(b)),
    contracts,
    maintained: [...maintained].sort((a, b) => maintenanceEnd(a) - maintenanceEnd(b)),
  };
});

const startSchema = z.object({
  action: z.literal("start-contract"),
  projectId: z.string().min(1),
  monthlyPrice: z.number().positive(),
  includedHours: z.number().min(0),
});

export const POST = adminRoute(["PM", "DIR"], async (_ctx, request) => {
  const parsed = startSchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const { projectId, monthlyPrice, includedHours } = parsed.data;

  // Démarrer un contrat fait sortir le projet de la garantie : les deux
  // écritures vont ensemble ou pas du tout, sinon le projet se retrouverait
  // classé en maintenance sans contrat (ou l'inverse).
  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { group: "MAI", phaseLabel: `Contrat ${monthlyPrice} €/mois` },
    }),
    prisma.maintenanceContract.create({
      data: {
        projectId,
        monthlyPrice,
        includedHours,
        usedHoursThisMonth: 0,
        renewalNote: "renouvellement annuel",
      },
    }),
  ]);
});
