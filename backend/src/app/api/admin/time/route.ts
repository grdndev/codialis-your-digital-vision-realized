import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { refreshAfterTimeChange, liveSessionHours } from "@/lib/work-sessions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Écran « Temps ». Accessible à toute session interne : chacun saisit son temps,
// et la vue d'équipe est ouverte à tous (elle l'était déjà avant la séparation).

export const GET = adminRoute(["DEV", "PM", "DIR"], async () => {
  // Le temps mesuré remonté à l'écran : ce qui tourne en ce moment, et les deux
  // dernières semaines pour donner du contexte à la répartition.
  const since = new Date(Date.now() - 14 * 24 * 3_600_000);

  const [entries, activeProjects, allProjects, openTasks, openTickets, sessions] =
    await Promise.all([
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
    prisma.workSession.findMany({
      where: { OR: [{ endedAt: null }, { startedAt: { gte: since } }] },
      include: {
        user: { select: { id: true, name: true, initials: true } },
        task: {
          select: {
            id: true,
            title: true,
            epic: { select: { project: { select: { name: true, client: { select: { name: true } } } } } },
          },
        },
        ticket: {
          select: {
            id: true,
            ref: true,
            title: true,
            project: { select: { name: true, client: { select: { name: true } } } },
          },
        },
      },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  // La part d'une session encore ouverte bouge à chaque seconde et dépend des
  // autres tâches menées en parallèle : on la calcule à la lecture plutôt que
  // d'écrire en base à chaque affichage.
  const live = await liveSessionHours(prisma, sessions);

  return {
    entries,
    activeProjects,
    allProjects,
    openTasks,
    openTickets,
    sessions: sessions.map((s) => ({ ...s, hours: live.get(s.id) ?? s.hours })),
  };
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

// Les heures passées d'une tâche, d'un ticket ou d'un projet sont désormais
// RECALCULÉES (voir `work-sessions`) : elles additionnent le mesuré et le
// déclaré, et une part mesurée dépend des autres tâches menées en parallèle.
// Seul le quota mensuel d'un contrat de maintenance reste incrémental — il
// compte le facturable du mois, pas le temps passé.
async function shiftContract(
  tx: Prisma.TransactionClient,
  entry: { projectId: string | null; date: Date },
  delta: number,
) {
  if (delta === 0 || !entry.projectId) return;
  const now = new Date();
  const sameMonth =
    entry.date.getUTCFullYear() === now.getUTCFullYear() &&
    entry.date.getUTCMonth() === now.getUTCMonth();
  if (!sameMonth) return;
  const contract = await tx.maintenanceContract.findUnique({
    where: { projectId: entry.projectId },
  });
  if (!contract) return;
  await tx.maintenanceContract.update({
    where: { projectId: entry.projectId },
    data: { usedHoursThisMonth: { increment: delta } },
  });
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
        await shiftContract(tx, entry, -entry.hours);
        await tx.timeEntry.delete({ where: { id: entry.id } });
      } else {
        await shiftContract(tx, entry, body.hours - entry.hours);
        await tx.timeEntry.update({
          where: { id: entry.id },
          data: {
            label: body.label,
            date: new Date(body.date),
            hours: body.hours,
            billable: body.billable,
          },
        });
      }
      await refreshAfterTimeChange(tx, {
        taskIds: entry.taskId ? [entry.taskId] : [],
        ticketIds: entry.ticketId ? [entry.ticketId] : [],
        projectIds: entry.projectId ? [entry.projectId] : [],
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
      if (task) projectId = task.epic.projectId;
    } else if (ticketId) {
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (ticket) projectId = ticket.projectId;
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

    await shiftContract(tx, { projectId, date }, hours);
    await refreshAfterTimeChange(tx, {
      taskIds: taskId ? [taskId] : [],
      ticketIds: ticketId ? [ticketId] : [],
      projectIds: projectId ? [projectId] : [],
    });
  });

  // Le frontend a besoin du projet réellement imputé pour revalider sa page.
  const resolved = await prisma.timeEntry.findFirst({
    where: { userId, label: body.label, date },
    orderBy: { id: "desc" },
    select: { projectId: true },
  });
  return { ok: true, projectId: resolved?.projectId ?? null };
});
