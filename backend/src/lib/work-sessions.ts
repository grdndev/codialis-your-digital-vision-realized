import "server-only";
import type { Prisma } from "@prisma/client";
import { DEFAULT_SCHEDULE, parseWeekdays, splitHours } from "@/lib/work-time";
import type { Schedule, Session } from "@/lib/work-time";

// Ouverture, fermeture et recalcul des chronomètres.
//
// Le temps passé affiché est la SOMME de deux sources : les sessions mesurées
// (statut « En cours ») et les saisies manuelles, qui restent pour ce qui ne
// relève d'aucune tâche — réunions, avant-vente, astreinte.
//
// Les compteurs `spentHours` et `hoursSpent` ne sont donc plus incrémentés au
// fil de l'eau mais RECALCULÉS : la part d'une session dépend des autres
// sessions de la même personne, et fermer l'une change la part des autres.

type Tx = Prisma.TransactionClient;

async function scheduleOf(tx: Tx, userId: string): Promise<Schedule> {
  const row = await tx.workSchedule.findUnique({ where: { userId } });
  if (!row) return DEFAULT_SCHEDULE;
  return {
    startMin: row.startMin,
    breakStartMin: row.breakStartMin,
    breakEndMin: row.breakEndMin,
    endMin: row.endMin,
    weekdays: parseWeekdays(row.weekdays),
  };
}

// Part de chaque session d'une personne : `computed` d'après ses dates
// (rognage + partage), `retained` = la durée corrigée à la main si elle existe,
// sinon le calcul. Une session corrigée en durée garde ses dates dans le
// partage : les sessions menées en parallèle ne voient pas leur part bouger.
// Une session encore ouverte est bornée à `now`.
async function sharesOf(
  db: Pick<Tx, "workSession" | "workSchedule">,
  userId: string,
  now: Date,
): Promise<Map<string, { computed: number; retained: number }>> {
  const rows = await db.workSession.findMany({
    where: { userId },
    select: { id: true, startedAt: true, endedAt: true, hoursOverride: true },
  });
  const sessions: Session[] = rows.map((r) => ({
    id: r.id,
    startedAt: r.startedAt,
    endedAt: r.endedAt ?? now,
  }));
  const computed = splitHours(sessions, await scheduleOf(db as Tx, userId));
  return new Map(
    rows.map((r) => {
      const value = computed.get(r.id) ?? 0;
      return [r.id, { computed: value, retained: r.hoursOverride ?? value }];
    }),
  );
}

// Recalcule la part de CHAQUE session de la personne. Une session encore
// ouverte est bornée à maintenant : son temps est provisoire et se réévaluera
// à la fermeture, mais l'affichage montre déjà ce qui court.
//
// Rend les tâches et tickets dont une session a changé de part : avec le
// partage, fermer ou corriger une session déplace aussi le temps des autres
// éléments menés en parallèle, et leur temps passé doit suivre. Seuls les
// éléments visés par l'appelant étaient rafraîchis ; ceux d'à côté gardaient
// un compteur périmé.
async function recomputeUserSessions(
  tx: Tx,
  userId: string,
): Promise<{ taskIds: string[]; ticketIds: string[] }> {
  const [rows, shares] = await Promise.all([
    tx.workSession.findMany({
      where: { userId },
      select: { id: true, hours: true, taskId: true, ticketId: true },
    }),
    sharesOf(tx, userId, new Date()),
  ]);
  const taskIds = new Set<string>();
  const ticketIds = new Set<string>();
  for (const row of rows) {
    const retained = shares.get(row.id)?.retained ?? 0;
    if (retained === row.hours) continue;
    await tx.workSession.update({ where: { id: row.id }, data: { hours: retained } });
    if (row.taskId) taskIds.add(row.taskId);
    if (row.ticketId) ticketIds.add(row.ticketId);
  }
  return { taskIds: [...taskIds], ticketIds: [...ticketIds] };
}

// `spentHours` d'une tâche ou d'un ticket : mesuré + déclaré.
async function refreshTask(tx: Tx, taskId: string): Promise<void> {
  const [measured, declared] = await Promise.all([
    tx.workSession.aggregate({ where: { taskId }, _sum: { hours: true } }),
    tx.timeEntry.aggregate({ where: { taskId }, _sum: { hours: true } }),
  ]);
  await tx.task.update({
    where: { id: taskId },
    data: { spentHours: (measured._sum.hours ?? 0) + (declared._sum.hours ?? 0) },
  });
}

async function refreshTicket(tx: Tx, ticketId: string): Promise<void> {
  const [measured, declared] = await Promise.all([
    tx.workSession.aggregate({ where: { ticketId }, _sum: { hours: true } }),
    tx.timeEntry.aggregate({ where: { ticketId }, _sum: { hours: true } }),
  ]);
  await tx.ticket.update({
    where: { id: ticketId },
    data: { spentHours: (measured._sum.hours ?? 0) + (declared._sum.hours ?? 0) },
  });
}

// Heures consommées d'un projet : tout ce qui lui est rattaché, mesuré comme
// déclaré. Recalculé de zéro pour ne jamais dériver.
export async function refreshProjectSpent(tx: Tx, projectId: string): Promise<void> {
  const [tasks, tickets, direct] = await Promise.all([
    tx.task.aggregate({ where: { epic: { projectId } }, _sum: { spentHours: true } }),
    tx.ticket.aggregate({ where: { projectId }, _sum: { spentHours: true } }),
    // Les saisies rattachées au projet seul, sans tâche ni ticket : elles ne
    // sont comptées nulle part ailleurs.
    tx.timeEntry.aggregate({
      where: { projectId, taskId: null, ticketId: null },
      _sum: { hours: true },
    }),
  ]);
  await tx.project.update({
    where: { id: projectId },
    data: {
      hoursSpent:
        (tasks._sum.spentHours ?? 0) + (tickets._sum.spentHours ?? 0) + (direct._sum.hours ?? 0),
      lastActivityAt: new Date(),
    },
  });
}

// Répercute un changement de temps sur toute la chaîne.
export async function refreshAfterTimeChange(
  tx: Tx,
  target: { userId?: string | null; taskIds?: string[]; ticketIds?: string[]; projectIds?: string[] },
): Promise<void> {
  const shifted = target.userId
    ? await recomputeUserSessions(tx, target.userId)
    : { taskIds: [], ticketIds: [] };

  const projectIds = new Set(target.projectIds ?? []);
  for (const taskId of new Set([...(target.taskIds ?? []), ...shifted.taskIds])) {
    await refreshTask(tx, taskId);
    const task = await tx.task.findUnique({
      where: { id: taskId },
      select: { epic: { select: { projectId: true } } },
    });
    if (task) projectIds.add(task.epic.projectId);
  }
  for (const ticketId of new Set([...(target.ticketIds ?? []), ...shifted.ticketIds])) {
    await refreshTicket(tx, ticketId);
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: { projectId: true },
    });
    if (ticket) projectIds.add(ticket.projectId);
  }
  for (const projectId of projectIds) await refreshProjectSpent(tx, projectId);
}

type Target = { taskId?: string | null; ticketId?: string | null };

// Ouvre un chronomètre au nom de l'ASSIGNÉ. Sans assigné, il n'y a personne à
// qui imputer le temps : on ne crée rien, l'appelant en avertit.
export async function openSession(
  tx: Tx,
  target: Target,
  assigneeId: string | null,
  startedById: string,
): Promise<boolean> {
  if (!assigneeId) return false;
  const where = target.taskId ? { taskId: target.taskId } : { ticketId: target.ticketId! };
  const running = await tx.workSession.findFirst({ where: { ...where, endedAt: null } });
  if (running) return true; // Déjà en cours : on ne double pas le chronomètre.

  await tx.workSession.create({
    data: {
      userId: assigneeId,
      startedById,
      taskId: target.taskId ?? null,
      ticketId: target.ticketId ?? null,
      startedAt: new Date(),
    },
  });
  await refreshAfterTimeChange(tx, {
    userId: assigneeId,
    taskIds: target.taskId ? [target.taskId] : [],
    ticketIds: target.ticketId ? [target.ticketId] : [],
  });
  return true;
}

// Ferme les chronomètres encore ouverts sur cette tâche ou ce ticket.
export async function closeSessions(tx: Tx, target: Target): Promise<void> {
  const where = target.taskId ? { taskId: target.taskId } : { ticketId: target.ticketId! };
  const open = await tx.workSession.findMany({ where: { ...where, endedAt: null } });
  if (!open.length) return;

  const now = new Date();
  for (const session of open) {
    await tx.workSession.update({ where: { id: session.id }, data: { endedAt: now } });
  }
  for (const userId of new Set(open.map((s) => s.userId))) {
    await refreshAfterTimeChange(tx, {
      userId,
      taskIds: target.taskId ? [target.taskId] : [],
      ticketIds: target.ticketId ? [target.ticketId] : [],
    });
  }
}

// Part de chaque session au moment de la lecture, sans rien écrire. Sert à
// l'affichage : un chronomètre qui tourne n'a pas de valeur figée, et la part
// d'une session dépend des autres menées en parallèle par la même personne.
export async function liveSessionHours(
  db: Pick<Tx, "workSession" | "workSchedule">,
  shown: { id: string; userId: string }[],
): Promise<Map<string, number>> {
  const detail = await liveSessionShares(db, shown);
  return new Map([...detail].map(([id, share]) => [id, share.retained]));
}

// Même lecture, avec aussi la part calculée d'après les dates : la fiche d'une
// tâche ou d'un ticket montre ce que le calcul aurait donné à côté d'une durée
// corrigée à la main.
export async function liveSessionShares(
  db: Pick<Tx, "workSession" | "workSchedule">,
  shown: { id: string; userId: string }[],
): Promise<Map<string, { computed: number; retained: number }>> {
  const result = new Map<string, { computed: number; retained: number }>();
  const now = new Date();
  // Toutes les sessions de la personne, pas seulement celles affichées : une
  // session hors fenêtre partage quand même le temps de celles qui y sont.
  for (const userId of new Set(shown.map((s) => s.userId))) {
    for (const [id, share] of await sharesOf(db, userId, now)) result.set(id, share);
  }
  return result;
}

// Les sessions d'une tâche ou d'un ticket, pour le bloc « Temps mesuré » de sa
// fiche : la plus récente d'abord, avec la part retenue et celle que le calcul
// donnerait d'après les dates. Les comptes ne sortent qu'en identité.
export async function sessionsOf(
  db: Pick<Tx, "workSession" | "workSchedule">,
  target: { taskId: string } | { ticketId: string },
) {
  const rows = await db.workSession.findMany({
    where: target,
    select: {
      id: true,
      userId: true,
      startedAt: true,
      endedAt: true,
      hours: true,
      hoursOverride: true,
      correctedAt: true,
      user: { select: { id: true, name: true, initials: true } },
      correctedBy: { select: { id: true, name: true } },
    },
    orderBy: { startedAt: "desc" },
  });
  const shares = await liveSessionShares(db, rows);
  return rows.map((r) => ({
    ...r,
    hours: shares.get(r.id)?.retained ?? r.hours,
    computedHours: shares.get(r.id)?.computed ?? r.hours,
  }));
}
