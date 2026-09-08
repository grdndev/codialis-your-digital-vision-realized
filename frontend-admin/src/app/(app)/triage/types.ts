import type { ClientRef, TicketRow, UserRef } from "@/lib/dto";

export type Tone = "Neutre" | "Rassurant" | "Ferme";

type TriageClient = ClientRef & { contactName: string | null };

export type TriageTicketRow = TicketRow & {
  project: { id: string; name: string; initials: string; client: TriageClient };
  assignee: UserRef | null;
};

export type TriageReplyRow = {
  id: string;
  ticketId: string;
  authorLabel: string;
  body: string;
  mine: boolean;
  createdAt: Date;
};

export type TicketAttachmentRow = {
  id: string;
  ticketId: string;
  filename: string;
  meta: string;
  createdAt: Date;
};

export type TriageDetailRow = TriageTicketRow & {
  attachments: TicketAttachmentRow[];
  triageReplies: TriageReplyRow[];
};

export type TriageScreen = {
  all: TriageTicketRow[];
  team: UserRef[];
  // Le ticket sélectionné, déjà résolu par le backend (premier de la liste, ou
  // celui désigné par `?ref=`). Null quand il n'y a aucun signalement.
  detail: TriageDetailRow | null;
};

// Brouillon de réponse rédigé par le backend : `source` dit s'il vient de
// Gemini ou du gabarit déterministe, `basis` liste ce sur quoi il s'appuie.
export type TriageDraft = {
  text: string;
  source: "gemini" | "template";
  basis: string[];
};
