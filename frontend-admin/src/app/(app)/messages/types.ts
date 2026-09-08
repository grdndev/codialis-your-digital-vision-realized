import type { ClientRef, ProjectWithClient, UserRef } from "@/lib/dto";
import type { ThreadKind } from "@/lib/types";

export type MessageRow = {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  citedTicketRef: string | null;
  citedLabel: string | null;
  createdAt: Date;
};

export type ThreadParticipantRow = {
  id: string;
  threadId: string;
  userId: string;
  lastReadAt: Date | null;
  user: UserRef;
};

type ThreadProject = { id: string; name: string; initials: string; client: ClientRef };

export type ThreadSummary = {
  id: string;
  kind: ThreadKind;
  projectId: string | null;
  title: string;
  createdAt: Date;
  project: ThreadProject | null;
  participants: ThreadParticipantRow[];
  // Le dernier message seulement : la liste n'affiche qu'un extrait.
  messages: MessageRow[];
};

export type ThreadRow = {
  thread: ThreadSummary;
  lastReadAt: Date | null;
  // Compté avant l'accusé de lecture : ce que l'utilisateur n'avait pas vu en arrivant.
  unread: number;
  lastMessage: MessageRow | null;
};

export type ThreadDetail = {
  id: string;
  kind: ThreadKind;
  projectId: string | null;
  title: string;
  createdAt: Date;
  project: ThreadProject | null;
  participants: ThreadParticipantRow[];
  messages: (MessageRow & { author: UserRef })[];
};

export type MessagesScreen = {
  rows: ThreadRow[];
  // Le fil ouvert, déjà choisi par le backend (celui demandé, ou le plus récent
  // de l'onglet). Null seulement si l'utilisateur ne participe à aucun fil.
  detail: ThreadDetail | null;
  projects: ProjectWithClient[];
};
