import { isoOf } from "@/lib/work-calendar";
import { OFFICE_UTC_OFFSET_MINUTES } from "@/lib/work-time";

// Notifications d'échéance (CC-366) : la cloche de la barre du haut.
//
// Rien n'est stocké — ni notification, ni « déjà vu » : la liste se DÉDUIT de
// l'état des tickets à chaque lecture. Une notification n'a donc pas à être
// fermée ; elle disparaît d'elle-même quand le ticket avance.
//
//   - L'ASSIGNÉ est prévenu tant que son ticket est À faire ou En cours. Le
//     passer En revue, c'est le livrer : l'échéance est tenue de son côté.
//   - La CHEFFERIE et la DIRECTION le sont tant qu'il est En revue, sur toute
//     l'agence : c'est à elles de constater et de clôturer (DEC-007).
//
// Ne comptent que les tickets qui ont une échéance, dépassée ou dans les
// DUE_SOON_DAYS prochains jours. La chefferie et la direction y voient aussi
// les messages du portail client sans réponse (CC-374, en fin de fichier). Ce
// module ne touche pas la base : il est testable seul
// (prisma/test-notifications.ts).

export const DUE_SOON_DAYS = 7;

const DAY_MS = 86_400_000;

export type NotificationReason = "assignee" | "review";

export type NotifiableTicket = {
  status: "A_FAIRE" | "EN_COURS" | "EN_REVUE" | "TERMINE" | "ANNULE";
  dueAt: Date | null;
  assigneeId: string | null;
  createdAt: Date;
};

export type DueNotification<T> = {
  ticket: T;
  reason: NotificationReason;
  // Jours entre aujourd'hui et l'échéance : négatif = en retard, 0 = aujourd'hui.
  days: number;
  overdue: boolean;
};

// Le jour de bureau à La Réunion : à 22 h UTC, c'est déjà demain là-bas.
export function officeTodayIso(now: Date): string {
  return isoOf(new Date(now.getTime() + OFFICE_UTC_OFFSET_MINUTES * 60_000));
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

// Une échéance est un JOUR, posé à 09:00 UTC (convention des dates sans heure
// de l'app) : sa date UTC est celle que l'écran affiche et que l'on a choisie.
function dueDayIso(dueAt: Date): string {
  return isoOf(dueAt);
}

// Premier jour qui n'est plus « bientôt » : la requête en base s'arrête avant.
export function dueHorizon(now: Date): Date {
  return new Date((dayNumber(officeTodayIso(now)) + DUE_SOON_DAYS + 1) * DAY_MS);
}

function reasonFor(ticket: NotifiableTicket, user: { id: string; role: string }): NotificationReason | null {
  if (ticket.assigneeId === user.id && (ticket.status === "A_FAIRE" || ticket.status === "EN_COURS")) {
    return "assignee";
  }
  if ((user.role === "PM" || user.role === "DIR") && ticket.status === "EN_REVUE") return "review";
  return null;
}

// Les échéances dépassées d'abord, la plus ancienne en tête ; puis celles qui
// approchent, la plus proche en tête. Trier par échéance croissante donne
// exactement cet ordre ; à échéance égale, le ticket le plus ancien passe devant.
export function dueNotifications<T extends NotifiableTicket>(
  tickets: T[],
  user: { id: string; role: string },
  now: Date,
): DueNotification<T>[] {
  const today = dayNumber(officeTodayIso(now));
  const out: DueNotification<T>[] = [];
  for (const ticket of tickets) {
    if (!ticket.dueAt) continue;
    const reason = reasonFor(ticket, user);
    if (!reason) continue;
    const days = dayNumber(dueDayIso(ticket.dueAt)) - today;
    if (days > DUE_SOON_DAYS) continue;
    out.push({ ticket, reason, days, overdue: days < 0 });
  }
  return out.sort(
    (a, b) =>
      a.days - b.days ||
      a.ticket.dueAt!.getTime() - b.ticket.dueAt!.getTime() ||
      a.ticket.createdAt.getTime() - b.ticket.createdAt.getTime(),
  );
}

// Messages du portail client restés sans réponse (CC-374), pour la chefferie
// et la direction. Même parti pris que les échéances : rien n'est stocké, ni
// « lu » ni « traité ». Un fil attend tant que ses derniers messages viennent
// du client ; la première réponse de l'agence l'en sort. Une réponse
// automatique (absence) ne compte pas : le client attend toujours quelqu'un.
export type ThreadMessage = { projectId: string; fromClient: boolean; auto: boolean; createdAt: Date };

export type WaitingThread = {
  projectId: string;
  // Le premier message resté sans réponse : depuis quand le client attend.
  since: Date;
  // Messages du client écrits depuis la dernière réponse.
  count: number;
};

// Le client qui attend depuis le plus longtemps en tête.
export function waitingClientThreads(messages: ThreadMessage[]): WaitingThread[] {
  const byProject = new Map<string, ThreadMessage[]>();
  for (const m of messages) {
    if (m.auto) continue;
    const list = byProject.get(m.projectId) ?? [];
    list.push(m);
    byProject.set(m.projectId, list);
  }

  const out: WaitingThread[] = [];
  for (const [projectId, list] of byProject) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let first = list.length;
    while (first > 0 && list[first - 1].fromClient) first--;
    const waiting = list.slice(first);
    if (waiting.length) out.push({ projectId, since: waiting[0].createdAt, count: waiting.length });
  }
  return out.sort((a, b) => a.since.getTime() - b.since.getTime());
}
