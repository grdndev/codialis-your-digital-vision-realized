import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Écran « Temps ». Accessible à toute session interne : chacun saisit son temps,
// et la vue d'équipe est ouverte à tous (elle l'était déjà avant la séparation).

export const GET = adminRoute(["DEV", "PM", "DIR"], async () => {
  const [entries, activeProjects, allProjects, openTasks, openTickets] = await Promise.all([
    prisma.timeEntry.findMany({
      include: { user: true, project: { include: { client: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.project.findMany({
      where: { group: "DEV" },
      include: { client: true },
      orderBy: { hoursSpent: "desc" },
    }),
    prisma.project.findMany({
      where: { group: { not: "CLO" } },
      include: { client: true },
      orderBy: { name: "asc" },
    }),
    prisma.task.findMany({
      where: { status: { not: "TERMINE" }, epic: { project: { group: { not: "CLO" } } } },
      include: { epic: { include: { project: { include: { client: true } } } } },
      orderBy: { title: "asc" },
    }),
    prisma.ticket.findMany({
      where: { status: { not: "TERMINE" } },
      include: { project: { include: { client: true } } },
      orderBy: { title: "asc" },
    }),
  ]);
  return { entries, activeProjects, allProjects, openTasks, openTickets };
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update-entry"),
    entryId: z.string().min(1),
    label: z.string().min(1),
    date: z.string().datetime(),
    hours: z.number().positive(),
    billable: z.boolean(),
  }),
  z.object({ action: z.literal("delete-entry"), entryId: z.string().min(1) }),
  z.object({
    action: z.literal("add-entry"),
    projectId: z.string().nullable(),
    taskId: z.string().nullable(),
    ticketId: z.string().nullable(),
    label: z.string().min(1),
    date: z.string().datetime(),
    hours: z.number().positive(),
    billable: z.boolean(),
  }),
]);

// Les compteurs d'heures passées (tâche, ticket, projet, contrat) sont des
// colonnes incrémentées à la saisie, pas des sommes recalculées. Corriger ou
// supprimer une entrée doit donc les rattraper du même écart, sans quoi
// l'avancement affiché dériverait à chaque correction.
async function shiftCounters(
  tx: Prisma.TransactionClient,
  entry: { projectId: string | null; taskId: string | null; ticketId: string | null; date: Date },
  delta: number,
) {
  if (delta === 0) return;
  if (entry.taskId) {
    await tx.task.update({ where: { id: entry.taskId }, data: { spentHours: { increment: delta } } });
  }
  if (entry.ticketId) {
    await tx.ticket.update({
      where: { id: entry.ticketId },
      data: { spentHours: { increment: delta } },
    });
  }
  if (!entry.projectId) return;

  await tx.project.update({
    where: { id: entry.projectId },
    data: { hoursSpent: { increment: delta }, lastActivityAt: new Date() },
  });

  const now = new Date();
  const sameMonth =
    entry.date.getUTCFullYear() === now.getUTCFullYear() &&
    entry.date.getUTCMonth() === now.getUTCMonth();
  if (!sameMonth) return;
  const contract = await tx.maintenanceContract.findUnique({
    where: { projectId: entry.projectId },
  });
  if (contract) {
    await tx.maintenanceContract.update({
      where: { projectId: entry.projectId },
      data: { usedHoursThisMonth: { increment: delta } },
    });
  }
}

export const POST = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  if (body.action === "update-entry" || body.action === "delete-entry") {
    const entry = await prisma.timeEntry.findUnique({ where: { id: body.entryId } });
    if (!entry) badRequest("Saisie introuvable");
    // Chacun corrige ses propres heures ; la direction peut reprendre celles de
    // l'équipe. Le rattachement (projet, tâche, ticket) ne bouge pas : il fait
    // autorité sur les compteurs, le changer reviendrait à déplacer des heures
    // d'un projet à l'autre en douce.
    if (entry.userId !== user.id && user.role !== "DIR") {
      badRequest("Cette saisie appartient à quelqu'un d'autre");
    }

    await prisma.$transaction(async (tx) => {
      if (body.action === "delete-entry") {
        await shiftCounters(tx, entry, -entry.hours);
        await tx.timeEntry.delete({ where: { id: entry.id } });
        return;
      }
      await shiftCounters(tx, entry, body.hours - entry.hours);
      await tx.timeEntry.update({
        where: { id: entry.id },
        data: {
          label: body.label,
          date: new Date(body.date),
          hours: body.hours,
          billable: body.billable,
        },
      });
    });

    return { ok: true, projectId: entry.projectId };
  }

  const date = new Date(body.date);
  const { taskId, ticketId, hours } = body;

  // L'entrée est toujours saisie pour soi : l'auteur vient de la session, jamais
  // du corps de la requête.
  const userId = user.id;

  await prisma.$transaction(async (tx) => {
    let projectId = body.projectId;

    // Une tâche ou un ticket rattaché fait autorité sur le projet imputé : il
    // ne peut pas contredire le projet choisi séparément dans le formulaire.
    if (taskId) {
      const task = await tx.task.findUnique({ where: { id: taskId }, include: { epic: true } });
      if (task) {
        projectId = task.epic.projectId;
        await tx.task.update({ where: { id: taskId }, data: { spentHours: { increment: hours } } });
      }
    } else if (ticketId) {
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (ticket) {
        projectId = ticket.projectId;
        await tx.ticket.update({ where: { id: ticketId }, data: { spentHours: { increment: hours } } });
      }
    }

    await tx.timeEntry.create({
      data: {
        userId,
        projectId,
        taskId,
        ticketId,
        label: body.label,
        date,
        hours,
        billable: body.billable,
        source: "MANUEL",
      },
    });

    if (projectId) {
      await tx.project.update({
        where: { id: projectId },
        data: { hoursSpent: { increment: hours }, lastActivityAt: new Date() },
      });

      const now = new Date();
      const sameMonth =
        date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
      if (sameMonth) {
        const contract = await tx.maintenanceContract.findUnique({ where: { projectId } });
        if (contract) {
          await tx.maintenanceContract.update({
            where: { projectId },
            data: { usedHoursThisMonth: { increment: hours } },
          });
        }
      }
    }
  });

  // Le frontend a besoin du projet réellement imputé pour revalider sa page.
  const resolved = await prisma.timeEntry.findFirst({
    where: { userId, label: body.label, date },
    orderBy: { id: "desc" },
    select: { projectId: true },
  });
  return { ok: true, projectId: resolved?.projectId ?? null };
});
