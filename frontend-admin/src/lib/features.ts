import type { TaskStatus, TicketType } from "@/lib/types";

// ANNULE n'arrive jamais au portail (filtré par l'API, CC-372) : l'entrée
// n'existe que pour que la table couvre tous les statuts.
export const CLIENT_STATE_LABEL: Record<TaskStatus, string> = {
  ANNULE: "Annulé",
  TERMINE: "Livré",
  EN_REVUE: "En test",
  EN_COURS: "En cours",
  A_FAIRE: "À venir",
};

export const CLIENT_STATE_BADGE_CLASS: Record<TaskStatus, string> = {
  ANNULE: "bg-white/5 text-muted",
  TERMINE: "bg-mint/10 text-mint",
  EN_REVUE: "bg-blue/10 text-blue",
  EN_COURS: "bg-blue/10 text-blue",
  A_FAIRE: "bg-white/5 text-muted",
};

// Ce que le portail montre d'un ticket : ni assigné, ni temps, ni estimation
// (voir lib/client-scope.ts côté backend). La description n'accompagne que les
// tickets d'un épic ; hors épic, elle est rédigée pour l'équipe (CC-374).
export type FeatureTicket = {
  id: string;
  ref: string;
  title: string;
  type: TicketType;
  description?: string;
  status: TaskStatus;
  dueAt: Date | null;
  updatedAt: Date;
};

export function movedThisWeek(tickets: FeatureTicket[], days = 7) {
  const cutoff = Date.now() - days * 86400000;
  const delivered = tickets.filter((t) => t.status === "TERMINE" && t.updatedAt.getTime() >= cutoff);
  const testing = tickets.filter((t) => t.status === "EN_REVUE" && t.updatedAt.getTime() >= cutoff);
  const started = tickets.filter((t) => t.status === "EN_COURS" && t.updatedAt.getTime() >= cutoff);
  return { delivered, testing, started };
}

// Compte à rebours d'une échéance, tel que le client le lit (CC-374). `days`
// vient de daysFromNow : 0 = aujourd'hui, négatif = dépassée.
export function dueCountdown(days: number): { text: string; late: boolean } {
  if (days < -1) return { text: `dépassée de ${-days} jours`, late: true };
  if (days === -1) return { text: "dépassée depuis hier", late: true };
  if (days === 0) return { text: "aujourd’hui", late: false };
  if (days === 1) return { text: "demain", late: false };
  return { text: `dans ${days} jours`, late: false };
}

// Hors épic, ce qui avance d'abord, puis ce qui attend d'être testé, puis ce
// qui est à venir ; à état égal, l'échéance la plus proche, puis l'ordre des
// références. Les livrés se rangent à part.
const OPEN_ORDER: TaskStatus[] = ["EN_COURS", "EN_REVUE", "A_FAIRE"];

export function sortOpenTickets(tickets: FeatureTicket[]): FeatureTicket[] {
  const rank = (t: FeatureTicket) => OPEN_ORDER.indexOf(t.status);
  const due = (t: FeatureTicket) => t.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return tickets
    .filter((t) => OPEN_ORDER.includes(t.status))
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t) - rank(b.t) || due(a.t) - due(b.t) || a.i - b.i)
    .map(({ t }) => t);
}
