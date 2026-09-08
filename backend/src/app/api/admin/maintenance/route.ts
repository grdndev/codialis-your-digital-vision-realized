import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Écran « Maintenance & garantie ».

export const GET = adminRoute(["PM", "DIR"], async () => {
  const [warranty, contracts] = await Promise.all([
    prisma.project.findMany({
      where: { group: "WAR" },
      include: { client: true },
      orderBy: { deadlineAt: "asc" },
    }),
    prisma.maintenanceContract.findMany({ include: { project: { include: { client: true } } } }),
  ]);
  return { warranty, contracts };
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
