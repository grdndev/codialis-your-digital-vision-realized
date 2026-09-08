import type { ClientRef, TaskRow, TicketRow, UserRef } from "@/lib/dto";
import type { AbsenceMode } from "@/lib/types";

export type PortalEpic = {
  id: string;
  projectId: string;
  title: string;
  objective: string | null;
  estHours: number;
  leadId: string | null;
  dueAt: Date | null;
  order: number;
  createdAt: Date;
  tasks: TaskRow[];
};

export type PortalProgressScreen = { epics: PortalEpic[] };

// Tickets remontés par le client uniquement : le travail interne de l'agence
// sur le projet ne lui est pas exposé.
export type PortalBugsScreen = { tickets: TicketRow[] };

export type ClientThreadMessageRow = {
  id: string;
  projectId: string;
  fromClient: boolean;
  authorLabel: string;
  body: string;
  auto: boolean;
  createdAt: Date;
};

export type PortalMessagesScreen = {
  messages: ClientThreadMessageRow[];
  // Seul le nom de la cheffe de projet est exposé.
  pm: { id: string; name: string } | null;
  // Réponse automatique active, s'il y en a une.
  absence: { mode: AbsenceMode } | null;
};

export type RdvRow = {
  id: string;
  projectId: string;
  whenAt: Date;
  whereLabel: string;
  hostId: string;
  cadence: string;
  // JSON : le tableau des points à l'ordre du jour.
  agenda: string;
  isPast: boolean;
  summary: string;
};

export type PortalRdvScreen = {
  next: (RdvRow & { host: UserRef }) | null;
  past: RdvRow[];
  host: { id: string; name: string } | null;
};

export type QuoteLineRow = {
  id: string;
  quoteId: string;
  ref: string | null;
  label: string;
  detail: string;
  hours: number;
  amount: number;
  status: string;
  order: number;
};

export type PaymentScheduleRow = {
  id: string;
  quoteId: string;
  label: string;
  amount: number;
  whenLabel: string;
  paid: boolean;
  order: number;
};

export type QuoteRow = {
  id: string;
  projectId: string;
  ref: string;
  signedAt: Date | null;
  totalAmount: number;
  totalHt: number;
  hoursSold: number;
  hourlyRate: number;
  paidAmount: number;
  lines: QuoteLineRow[];
  schedule: PaymentScheduleRow[];
};

export type PortalCdcDocRow = {
  id: string;
  projectId: string;
  name: string;
  version: string;
  meta: string;
  status: string;
  // JSON : les sections rédigées du cahier des charges.
  sections: string;
  order: number;
};

// Un seul des trois volets est rempli, selon l'onglet demandé.
export type PortalProjectScreen = {
  tab: "devis" | "features" | "cdc";
  quote: QuoteRow | null;
  epics: PortalEpic[];
  docs: PortalCdcDocRow[];
};

export type { ClientRef };
