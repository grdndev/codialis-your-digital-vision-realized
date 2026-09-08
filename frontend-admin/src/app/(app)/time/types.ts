import type { ProjectWithClient, TaskRow, TicketRow, UserRef } from "@/lib/dto";

export type TimeEntryRow = {
  id: string;
  userId: string;
  projectId: string | null;
  taskId: string | null;
  ticketId: string | null;
  label: string;
  date: Date;
  hours: number;
  billable: boolean;
  source: string;
  user: UserRef;
  project: ProjectWithClient | null;
};

export type OpenTaskRow = TaskRow & {
  epic: { id: string; title: string; projectId: string; project: ProjectWithClient };
};

export type OpenTicketRow = TicketRow & { project: ProjectWithClient };

export type TimeScreen = {
  entries: TimeEntryRow[];
  activeProjects: ProjectWithClient[];
  allProjects: ProjectWithClient[];
  openTasks: OpenTaskRow[];
  openTickets: OpenTicketRow[];
};
