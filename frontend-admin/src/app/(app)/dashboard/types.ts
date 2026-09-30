import type { InternalTaskRow, ProjectWithClient, TicketRow, UserRef } from "@/lib/dto";

export type DashboardTicket = TicketRow & { project: { id: string; name: string; initials: string } };

export type DashboardScreen = {
  activeProjects: ProjectWithClient[];
  openTickets: DashboardTicket[];
  clientCount: number;
  myInternalTasks: (InternalTaskRow & { assigner: UserRef })[];
  // Toute l'équipe interne : chacun peut se confier une tâche ou en confier une
  // à un collègue.
  team: UserRef[];
  givenInternalTasks: (InternalTaskRow & { assignee: UserRef })[];
  totalProjects: number;
  goals: GoalRow[];
  // Projets rattachables à un objectif ; vide hors direction.
  goalProjects: { id: string; name: string; client: { name: string } }[];
};

// Objectif du mois (CC-347). `project` est null quand l'objectif n'en suit
// aucun, ou quand la personne connectée ne peut pas ouvrir ce projet.
export type GoalRow = {
  id: string;
  title: string;
  detail: string;
  dueAt: Date;
  projectId: string | null;
  doneAt: Date | null;
  project: {
    id: string;
    name: string;
    progressPct: number;
    hoursSpent: number;
    hoursSold: number;
    deadlineAt: Date | null;
    client: { name: string };
  } | null;
};
