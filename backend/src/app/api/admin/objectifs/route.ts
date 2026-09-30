import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { applyGoalAction, goalBodySchema, goalsFor } from "@/lib/goals";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Écran « Objectifs » (CC-356) — ouvert à toute l'équipe, piloté par la
// direction. Tous les objectifs, ceux en cours comme l'historique des clos :
// on y lit ce qui a été atteint, ce qui ne l'a pas été, et pourquoi.
//
// C'est aussi la seule route qui ÉCRIT un objectif : le bloc du Dashboard
// envoie ici ses constats plutôt que de dupliquer les règles.

export const GET = adminRoute(["DIR", "PM", "DEV"], async ({ user }) => {
  const [goals, projects] = await Promise.all([
    goalsFor(user, {}),
    // Les projets rattachables, pour le formulaire de la direction seule.
    user.role === "DIR"
      ? prisma.project.findMany({
          where: { group: { not: "CLO" } },
          select: { id: true, name: true, client: { select: { name: true } } },
          orderBy: { name: "asc" },
        })
      : [],
  ]);
  return { goals, projects };
});

export const POST = adminRoute(["DIR", "PM", "DEV"], async ({ user }, request) => {
  const parsed = goalBodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  await applyGoalAction(user, parsed.data);
});
