import { z } from "zod";
import { adminRoute, badRequest, jsonBody } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { refreshAfterTimeChange, liveSessionHours } from "@/lib/work-sessions";
import { recomputeProjectProgress } from "@/lib/project-progress";
import type { Prisma, Role, TaskStatus } from "@prisma/client";

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
  // Correction après coup d'une session de temps mesuré, depuis la fiche d'une
  // tâche ou d'un ticket. Les dates recalculent la durée ; une durée saisie la
  // remplace pour cette seule session. Une session encore ouverte s'arrête à
  // une heure passée, et l'élément quitte « En cours » pour le statut choisi.
  z.object({
    action: z.literal("correct-session-dates"),
    sessionId: z.string().min(1),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
  }),
  z.object({
    action: z.literal("correct-session-hours"),
    sessionId: z.string().min(1),
    hours: z.number().min(0).max(1000),
  }),
  z.object({
    action: z.literal("stop-session"),
    sessionId: z.string().min(1),
    endedAt: z.string().datetime(),
    status: z.enum(["A_FAIRE", "EN_REVUE", "TERMINE"]),
  }),
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

type SessionCorrection = Extract<
  z.infer<typeof bodySchema>,
  { action: "correct-session-dates" | "correct-session-hours" | "stop-session" }
>;

// Une minute de marge sur « pas dans le futur » : l'horloge du navigateur et
// celle du serveur ne sont jamais tout à fait d'accord.
const CLOCK_SLACK_MS = 60_000;

async function correctSession(user: { id: string; role: Role }, body: SessionCorrection) {
  const session = await prisma.workSession.findUnique({
    where: { id: body.sessionId },
    include: {
      task: { select: { id: true, status: true, epic: { select: { projectId: true } } } },
      ticket: { select: { id: true, status: true } },
    },
  });
  if (!session) badRequest("Session introuvable");
  // Le temps se corrige par la personne à qui il appartient, ou par la
  // chefferie de projet. Pas par la direction : arbitrage Denis du 07/10.
  if (session.userId !== user.id && user.role !== "PM") {
    badRequest("Seuls la personne dont c'est le temps et la chefferie de projet peuvent le corriger");
  }

  const now = Date.now();
  const corrected = { correctedById: user.id, correctedAt: new Date() };
  const refresh = (tx: Prisma.TransactionClient) =>
    refreshAfterTimeChange(tx, {
      userId: session.userId,
      taskIds: session.taskId ? [session.taskId] : [],
      ticketIds: session.ticketId ? [session.ticketId] : [],
    });

  if (body.action === "stop-session") {
    if (session.endedAt) badRequest("Cette session est déjà arrêtée : corrigez plutôt ses dates");
    const endedAt = new Date(body.endedAt);
    if (endedAt <= session.startedAt) badRequest("L'arrêt doit être postérieur au démarrage");
    if (endedAt.getTime() > now + CLOCK_SLACK_MS) badRequest("L'arrêt ne peut pas être dans le futur");

    // L'élément ne quitte « En cours » que s'il y est encore : une session
    // restée ouverte sur un élément déjà clos (statut changé par un script,
    // TRAP-041) se ferme sans toucher à son statut.
    const item = session.task ?? session.ticket;
    const leavesInProgress = item?.status === "EN_COURS";
    if (leavesInProgress && session.ticket && body.status === "TERMINE" && user.role === "DEV") {
      badRequest("La clôture revient à la chefferie de projet ou à la direction.");
    }
    const status: TaskStatus = body.status;
    await prisma.$transaction(async (tx) => {
      await tx.workSession.update({ where: { id: session.id }, data: { endedAt, ...corrected } });
      if (leavesInProgress && session.task) await tx.task.update({ where: { id: session.task.id }, data: { status } });
      if (leavesInProgress && session.ticket) await tx.ticket.update({ where: { id: session.ticket.id }, data: { status } });
      await refresh(tx);
    });
    if (leavesInProgress && session.task) await recomputeProjectProgress(session.task.epic.projectId);
    return { ok: true };
  }

  // Une session ouverte n'a pas encore de durée à corriger : elle s'arrête.
  if (!session.endedAt) badRequest("Cette session est en cours : arrêtez-la d'abord");

  if (body.action === "correct-session-hours") {
    await prisma.$transaction(async (tx) => {
      await tx.workSession.update({
        where: { id: session.id },
        data: { hoursOverride: body.hours, ...corrected },
      });
      await refresh(tx);
    });
    return { ok: true };
  }

  const startedAt = new Date(body.startedAt);
  const endedAt = new Date(body.endedAt);
  if (endedAt <= startedAt) badRequest("La fin doit être postérieure au début");
  if (endedAt.getTime() > now + CLOCK_SLACK_MS) badRequest("La fin ne peut pas être dans le futur");
  // Corriger les dates, c'est revenir au calcul : une durée saisie auparavant
  // n'aurait plus rien à voir avec les nouvelles bornes.
  await prisma.$transaction(async (tx) => {
    await tx.workSession.update({
      where: { id: session.id },
      data: { startedAt, endedAt, hoursOverride: null, ...corrected },
    });
    await refresh(tx);
  });
  return { ok: true };
}

export const POST = adminRoute(["DEV", "PM", "DIR"], async ({ user }, request) => {
  const parsed = bodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) badRequest("Requête invalide");
  const body = parsed.data;

  if (
    body.action === "correct-session-dates" ||
    body.action === "correct-session-hours" ||
    body.action === "stop-session"
  ) {
    return correctSession(user, body);
  }

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
