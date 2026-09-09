import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// Écran « Projets » — liste, plus toutes les mutations des écrans projet
// (liste, détail, fiche, détail de tâche), regroupées ici parce qu'elles
// touchent le même agrégat.

export const GET = adminRoute(["DIR", "PM"], async () => ({
  allProjects: await prisma.project.findMany({
    include: { client: true },
    orderBy: [{ openedAt: "desc" }],
  }),
}));

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  A_FAIRE: "EN_COURS",
  EN_COURS: "EN_REVUE",
  EN_REVUE: "TERMINE",
  TERMINE: null,
};

// `Project.progressPct` est une colonne stockée, relue directement par le
// dashboard, la liste des projets et le portail client — pas un calcul fait à
// chaque lecture. Il faut donc la rafraîchir dès qu'une tâche apparaît ou change
// d'état. Un projet sans tâche modélisée garde sa valeur : une liste vide n'est
// pas la preuve d'un avancement nul, seulement de ce qui n'est pas suivi à ce
// niveau de détail.
async function recomputeProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { epic: { projectId } },
    select: { status: true },
  });
  if (tasks.length === 0) return;
  const done = tasks.filter((t) => t.status === "TERMINE").length;
  await prisma.project.update({
    where: { id: projectId },
    data: { progressPct: Math.round((done / tasks.length) * 100) },
  });
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-epic"),
    projectId: z.string().min(1),
    title: z.string().min(1),
    estHours: z.number().min(0),
    leadId: z.string().nullable(),
    dueAt: z.string().datetime().nullable(),
  }),
  z.object({
    action: z.literal("create-task"),
    epicId: z.string().min(1),
    projectId: z.string().min(1),
    title: z.string().min(1),
    estHours: z.number().min(0),
    assigneeId: z.string().nullable(),
  }),
  z.object({
    action: z.literal("update-task-status"),
    taskId: z.string().min(1),
    projectId: z.string().min(1),
    transition: z.enum(["advance", "reopen"]),
  }),
  z.object({ action: z.literal("toggle-task-criterion"), criterionId: z.string().min(1) }),
  z.object({
    action: z.literal("add-task-comment"),
    taskId: z.string().min(1),
    body: z.string().min(1),
  }),
  z.object({
    action: z.literal("update-client-contact"),
    clientId: z.string().min(1),
    contactName: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
  }),
  z.object({
    action: z.literal("update-project-description"),
    projectId: z.string().min(1),
    description: z.string(),
  }),
  z.object({
    action: z.literal("add-client-question"),
    projectId: z.string().min(1),
    question: z.string().min(1),
  }),
  z.object({ action: z.literal("mark-question-asked"), questionId: z.string().min(1) }),
  z.object({
    action: z.literal("answer-client-question"),
    questionId: z.string().min(1),
    answer: z.string().min(1),
  }),
]);

export const POST = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  switch (body.action) {
    case "create-epic": {
      const count = await prisma.epic.count({ where: { projectId: body.projectId } });
      await prisma.epic.create({
        data: {
          projectId: body.projectId,
          title: body.title,
          estHours: body.estHours,
          leadId: body.leadId,
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
          order: count,
        },
      });
      return;
    }

    case "create-task": {
      const count = await prisma.task.count({ where: { epicId: body.epicId } });
      await prisma.task.create({
        data: {
          epicId: body.epicId,
          title: body.title,
          estHours: body.estHours,
          assigneeId: body.assigneeId,
          order: count,
          description: ""
        },
      });
      await recomputeProjectProgress(body.projectId);
      return;
    }

    case "update-task-status": {
      const task = await prisma.task.findUnique({ where: { id: body.taskId } });
      if (!task) badRequest("Tâche introuvable");

      const nextStatus = body.transition === "reopen" ? "A_FAIRE" : NEXT_STATUS[task.status];
      // Une tâche déjà terminée n'a pas d'étape suivante.
      if (!nextStatus) return;

      await prisma.task.update({ where: { id: body.taskId }, data: { status: nextStatus } });
      await recomputeProjectProgress(body.projectId);
      return;
    }

    case "toggle-task-criterion": {
      const criterion = await prisma.taskCriterion.findUnique({
        where: { id: body.criterionId },
      });
      if (!criterion) badRequest("Critère introuvable");
      await prisma.taskCriterion.update({
        where: { id: body.criterionId },
        data: { done: !criterion.done },
      });
      return;
    }

    case "add-task-comment":
      // L'auteur est la session.
      await prisma.taskComment.create({
        data: { taskId: body.taskId, authorId: user.id, body: body.body },
      });
      return;

    case "update-client-contact":
      await prisma.client.update({
        where: { id: body.clientId },
        data: {
          contactName: body.contactName,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
        },
      });
      return;

    case "update-project-description":
      await prisma.project.update({
        where: { id: body.projectId },
        data: { description: body.description },
      });
      return;

    case "add-client-question":
      await prisma.clientQuestion.create({
        data: { projectId: body.projectId, question: body.question, answer: "" },
      });
      return;

    case "mark-question-asked":
      await prisma.clientQuestion.update({
        where: { id: body.questionId },
        data: { status: "DEMANDE", askedAt: new Date() },
      });
      return;

    case "answer-client-question":
      await prisma.clientQuestion.update({
        where: { id: body.questionId },
        data: { status: "REPONDU", answer: body.answer, answeredAt: new Date() },
      });
      return;
  }
});
