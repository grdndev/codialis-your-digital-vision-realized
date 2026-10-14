import type { ProjectWithClient, TicketRow, UserRef } from "@/lib/dto";

export type TimeEntryRow = {
  id: string;
  userId: string | null;
  projectId: string | null;
  ticketId: string | null;
  label: string;
  date: Date;
  hours: number;
  billable: boolean;
  source: string;
  user: UserRef | null;
  project: ProjectWithClient | null;
};

export type OpenTicketRow = TicketRow & { project: ProjectWithClient };

// Temps mesuré : une session s'ouvre quand un ticket passe « En cours » et se
// ferme au changement de statut suivant. `hours` est la PART de la personne —
// deux tickets menés en parallèle se partagent le temps écoulé.
export type WorkSessionRow = {
  id: string;
  userId: string;
  startedById: string | null;
  ticketId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  hours: number;
  user: { id: string; name: string; initials: string };
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
  openTickets: OpenTicketRow[];
  sessions: WorkSessionRow[];
};
