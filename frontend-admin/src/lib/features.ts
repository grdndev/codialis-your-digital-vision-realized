import type { TaskStatus } from "@/lib/types";

export const CLIENT_STATE_LABEL: Record<TaskStatus, string> = {
  TERMINE: "Livré",
  EN_REVUE: "En test",
  EN_COURS: "En cours",
  A_FAIRE: "À venir",
};

export const CLIENT_STATE_BADGE_CLASS: Record<TaskStatus, string> = {
  TERMINE: "bg-mint/10 text-mint",
  EN_REVUE: "bg-blue/10 text-blue",
  EN_COURS: "bg-blue/10 text-blue",
  A_FAIRE: "bg-white/5 text-muted",
};

// Ce que le portail montre d'un ticket rangé dans un épic : ni assigné, ni
// temps, ni estimation (voir `portalEpics` côté backend).
export type FeatureTicket = { id: string; ref: string; title: string; description: string; status: TaskStatus; updatedAt: Date };

export function movedThisWeek(tickets: FeatureTicket[], days = 7) {
  const cutoff = Date.now() - days * 86400000;
  const delivered = tickets.filter((t) => t.status === "TERMINE" && t.updatedAt.getTime() >= cutoff);
  const testing = tickets.filter((t) => t.status === "EN_REVUE" && t.updatedAt.getTime() >= cutoff);
  const started = tickets.filter((t) => t.status === "EN_COURS" && t.updatedAt.getTime() >= cutoff);
  return { delivered, testing, started };
}
