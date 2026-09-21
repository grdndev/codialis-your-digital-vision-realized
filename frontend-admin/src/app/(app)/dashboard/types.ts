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
};
