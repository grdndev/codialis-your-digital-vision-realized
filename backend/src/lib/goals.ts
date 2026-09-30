import "server-only";
import { z } from "zod";
import type { Prisma, Role } from "@prisma/client";
import { badRequest } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { visibleProjectIds } from "@/lib/project-access";

// Objectifs (CC-347, CC-356) : posés et clos par la direction, lus par toute
// l'équipe — sur le Dashboard (ceux du mois) et dans l'écran Objectifs (tous,
// historique compris). Les deux écrans lisent par ici ; seul l'écran Objectifs
// écrit.

const PROJECT_OF_GOAL = {
  select: {
    id: true,
    name: true,
    progressPct: true,
    hoursSpent: true,
    hoursSold: true,
    deadlineAt: true,
    client: { select: { name: true } },
  },
} as const;

// Un objectif se lit par tous ; le projet qu'il suit, seulement par qui peut
// ouvrir ce projet (DEC-024) — sinon l'avancement d'un projet cloisonné
// s'afficherait à un développeur qui n'y a rien.
export async function goalsFor(user: { id: string; role: Role }, where: Prisma.MonthlyGoalWhereInput) {
  const [visibleIds, goals] = await Promise.all([
    visibleProjectIds(user),
    prisma.monthlyGoal.findMany({
      where,
      include: { project: PROJECT_OF_GOAL, author: { select: { name: true } } },
      orderBy: { dueAt: "asc" },
    }),
  ]);
  return goals.map((g) => ({
    ...g,
    project: g.project && (visibleIds === null || visibleIds.includes(g.project.id)) ? g.project : null,
  }));
}

const goalFields = {
  title: z.string().trim().min(1).max(300),
  detail: z.string().max(5000),
  dueAt: z.string().datetime(),
  projectId: z.string().min(1).nullable(),
};

export const goalBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create-goal"), ...goalFields }),
  z.object({ action: z.literal("update-goal"), goalId: z.string().min(1), ...goalFields }),
  // Le constat : atteint, ou non atteint — et alors il faut dire pourquoi,
  // c'est tout l'intérêt de l'historique (CC-356).
  z.object({
    action: z.literal("close-goal"),
    goalId: z.string().min(1),
    outcome: z.enum(["ATTEINT", "NON_ATTEINT"]),
    note: z.string().max(5000),
  }),
  z.object({ action: z.literal("reopen-goal"), goalId: z.string().min(1) }),
  z.object({ action: z.literal("delete-goal"), goalId: z.string().min(1) }),
]);

export async function applyGoalAction(
  user: { id: string; role: Role },
  body: z.infer<typeof goalBodySchema>,
): Promise<void> {
  // Les objectifs se pilotent par la direction : Jayan les pose, les ajuste,
  // en fait le constat. Le reste de l'équipe les lit.
  if (user.role !== "DIR") badRequest("Les objectifs sont posés par la direction");

  switch (body.action) {
    case "create-goal":
    case "update-goal": {
      const data = {
        title: body.title,
        detail: body.detail.trim(),
        dueAt: new Date(body.dueAt),
        projectId: body.projectId,
      };
      if (body.action === "create-goal") {
        await prisma.monthlyGoal.create({ data: { ...data, authorId: user.id } });
      } else {
        await prisma.monthlyGoal.update({ where: { id: body.goalId }, data });
      }
      return;
    }
    case "close-goal": {
      const note = body.note.trim();
      if (body.outcome === "NON_ATTEINT" && !note) {
        badRequest("Dites pourquoi l'objectif n'a pas été atteint : c'est ce qui fait le suivi");
      }
      await prisma.monthlyGoal.update({
        where: { id: body.goalId },
        data: { outcome: body.outcome, outcomeNote: note || null, closedAt: new Date() },
      });
      return;
    }
    case "reopen-goal":
      await prisma.monthlyGoal.update({
        where: { id: body.goalId },
        data: { outcome: null, outcomeNote: null, closedAt: null },
      });
      return;
    case "delete-goal":
      await prisma.monthlyGoal.delete({ where: { id: body.goalId } });
      return;
  }
}
