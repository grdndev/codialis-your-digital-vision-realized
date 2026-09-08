import type { InternalTaskRow, ProjectWithClient, TicketRow, UserRef } from "@/lib/dto";

export type DashboardTicket = TicketRow & { project: { id: string; name: string; initials: string } };

export type DashboardScreen = {
  activeProjects: ProjectWithClient[];
  openTickets: DashboardTicket[];
  clientCount: number;
  myInternalTasks: (InternalTaskRow & { assigner: UserRef })[];
  // Vide pour une cheffe de projet : ces deux listes sont réservées à la direction.
  pmUsers: UserRef[];
  givenInternalTasks: (InternalTaskRow & { assignee: UserRef })[];
  totalProjects: number;
};
