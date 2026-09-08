import { z } from "zod";
import { adminRoute, badRequest } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/projects/detail?id=[&fiche=1]
//
// Renvoie le projet, ses épiques et leurs tâches, plus l'équipe assignable.
// Les données de l'onglet « Fiche » (accès techniques, questions client) ne
// sont chargées que si l'onglet est ouvert : c'est deux requêtes de moins sur
// les vues Liste et Kanban, qui sont les plus consultées.
//
// `access` distingue les deux raisons d'un écran vide : le projet n'existe pas,
// ou le développeur n'y est pas assigné — l'écran affiche un message différent
// dans chaque cas.

const querySchema = z.object({ id: z.string().min(1), fiche: z.boolean() });

export const GET = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    id: params.get("id"),
    fiche: params.get("fiche") === "1",
  });
  if (!parsed.success) badRequest("Requête invalide");
  const { id, fiche } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      epics: {
        orderBy: { order: "asc" },
        include: { lead: true, tasks: { orderBy: { order: "asc" }, include: { assignee: true } } },
      },
    },
  });
  if (!project) return { access: "not-found" as const };

  if (user.role === "DEV") {
    const assigned = await prisma.projectAssignment.findFirst({
      where: { projectId: project.id, userId: user.id },
      select: { id: true },
    });
    if (!assigned) return { access: "not-assigned" as const };
  }

  const [team, apis, questions] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["DEV", "PM"] } }, orderBy: { name: "asc" } }),
    fiche ? prisma.apiCredential.findMany({ where: { projectId: id }, orderBy: { order: "asc" } }) : [],
    fiche
      ? prisma.clientQuestion.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } })
      : [],
  ]);

  return {
    access: "ok" as const,
    project,
    team: team.map((t) => ({ id: t.id, name: t.name })),
    apis,
    questions,
  };
});
