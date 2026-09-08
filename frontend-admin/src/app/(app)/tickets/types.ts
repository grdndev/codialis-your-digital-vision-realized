import type { ClientRef, ProjectWithClient, TicketRow, UserRef } from "@/lib/dto";

export type EpicRef = { id: string; title: string; projectId: string };

export type TicketListRow = TicketRow & {
  project: ProjectWithClient;
  epic: EpicRef | null;
  assignee: UserRef | null;
};

export type TicketsScreen = {
  projects: ProjectWithClient[];
  // Déjà filtré côté API : par les filtres de l'écran ET par les projets
  // auxquels le rôle donne accès.
  tickets: TicketListRow[];
};

export type TicketCriterionRow = {
  id: string;
  ticketId: string;
  label: string;
  done: boolean;
  order: number;
};

export type TicketCommentRow = {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  author: UserRef;
};

export type TicketAttachmentRow = {
  id: string;
  ticketId: string;
  filename: string;
  meta: string;
  createdAt: Date;
};

type DetailClient = ClientRef & { contactName: string | null };

export type TicketDetail = TicketRow & {
  project: Omit<ProjectWithClient, "client"> & { client: DetailClient };
  epic: EpicRef | null;
  assignee: UserRef | null;
  creator: UserRef | null;
  criteria: TicketCriterionRow[];
  comments: TicketCommentRow[];
  attachments: TicketAttachmentRow[];
};

// Null sur une référence inconnue — ou sur un ticket hors du périmètre du rôle,
// que l'API traite de la même façon : il n'existe pas pour cet utilisateur.
export type TicketDetailResponse = { ticket: TicketDetail | null };

export type NewTicketScreen = {
  projects: { id: string; label: string; epics: { id: string; title: string }[] }[];
  team: { id: string; name: string }[];
};
