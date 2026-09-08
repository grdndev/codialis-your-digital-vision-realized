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

export type FeatureTask = { id: string; title: string; description: string; status: TaskStatus; updatedAt: Date };
export type FeatureGroup = { id: string; title: string; tasks: FeatureTask[] };

export function movedThisWeek(tasks: FeatureTask[], days = 7) {
  const cutoff = Date.now() - days * 86400000;
  const delivered = tasks.filter((t) => t.status === "TERMINE" && t.updatedAt.getTime() >= cutoff);
  const testing = tasks.filter((t) => t.status === "EN_REVUE" && t.updatedAt.getTime() >= cutoff);
  const started = tasks.filter((t) => t.status === "EN_COURS" && t.updatedAt.getTime() >= cutoff);
  return { delivered, testing, started };
}
