import { z } from "zod";
import { adminRoute, badRequest } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/projects/task?projectId=&taskId= — une tâche et son dossier.
//
// La tâche doit appartenir au projet de l'URL : sans cette vérification, une
// tâche d'un autre projet s'afficherait sous un fil d'Ariane mensonger.

const querySchema = z.object({ projectId: z.string().min(1), taskId: z.string().min(1) });

export const GET = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
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

  // Même cloisonnement que le détail projet.
  if (user.role === "DEV") {
    const assigned = await prisma.projectAssignment.findFirst({
      where: { projectId, userId: user.id },
      select: { id: true },
    });
    if (!assigned) return { task: null };
  }

  return { task };
});
