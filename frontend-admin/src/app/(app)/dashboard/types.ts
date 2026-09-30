import type { InternalTaskRow, ProjectWithClient, TicketRow, UserRef } from "@/lib/dto";
import type { GoalProject, GoalRow } from "../objectifs/types";

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
  // Objectifs en cours et clos ce mois-ci (voir l'écran Objectifs).
  goals: GoalRow[];
  // Projets rattachables à un objectif ; vide hors direction.
  goalProjects: GoalProject[];
};
