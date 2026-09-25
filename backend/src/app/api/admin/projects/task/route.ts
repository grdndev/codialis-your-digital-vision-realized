import { z } from "zod";
import { adminRoute, badRequest } from "@/lib/admin-api";
import { avecUrlPublique } from "@/lib/files";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/projects/task?projectId=&taskId= — une tâche et son dossier.
//
// La tâche doit appartenir au projet de l'URL : sans cette vérification, une
// tâche d'un autre projet s'afficherait sous un fil d'Ariane mensonger.

const querySchema = z.object({ projectId: z.string().min(1), taskId: z.string().min(1) });

export const GET = adminRoute(["DEV", "PM", "DIR"], async (_ctx, request) => {
  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    projectId: params.get("projectId"),
    taskId: params.get("taskId"),
  });
  if (!parsed.success) badRequest("Requête invalide");
  const { projectId, taskId } = parsed.data;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      epic: { include: { project: { include: { client: true } } } },
      assignee: true,
      criteria: { orderBy: { order: "asc" } },
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      attachments: true,
    },
  });
  if (!task || task.epic.projectId !== projectId) return { task: null };

  // De quoi alimenter le formulaire de modification : les lots du projet et
  // l'équipe interne, à qui la tâche peut être réassignée.
  const [epics, team] = await Promise.all([
    prisma.epic.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
      select: { id: true, title: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["DEV", "PM", "DIR"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    task: { ...task, attachments: task.attachments.map(avecUrlPublique) },
    epics,
    team,
  };
});
