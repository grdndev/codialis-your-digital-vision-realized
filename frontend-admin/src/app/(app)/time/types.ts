import type { ProjectWithClient, TaskRow, TicketRow, UserRef } from "@/lib/dto";

export type TimeEntryRow = {
  id: string;
  userId: string | null;
  projectId: string | null;
  taskId: string | null;
  ticketId: string | null;
  label: string;
  date: Date;
  hours: number;
  billable: boolean;
  source: string;
  user: UserRef | null;
  project: ProjectWithClient | null;
};

export type OpenTaskRow = TaskRow & {
  epic: { id: string; title: string; projectId: string; project: ProjectWithClient };
};

export type OpenTicketRow = TicketRow & { project: ProjectWithClient };

// Temps mesuré : une session s'ouvre quand une tâche passe « En cours » et se
// ferme au changement de statut suivant. `hours` est la PART de la personne —
// deux tâches menées en parallèle se partagent le temps écoulé.
export type WorkSessionRow = {
  id: string;
  userId: string;
  startedById: string | null;
  taskId: string | null;
  ticketId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  hours: number;
  user: { id: string; name: string; initials: string };
  task: {
    id: string;
    title: string;
    epic: { project: { name: string; client: { name: string } } };
  } | null;
  ticket: {
    id: string;
    ref: string;
    title: string;
    project: { name: string; client: { name: string } };
  } | null;
};

export type TimeScreen = {
  entries: TimeEntryRow[];
  activeProjects: ProjectWithClient[];
  allProjects: ProjectWithClient[];
  openTasks: OpenTaskRow[];
  openTickets: OpenTicketRow[];
  sessions: WorkSessionRow[];
};
