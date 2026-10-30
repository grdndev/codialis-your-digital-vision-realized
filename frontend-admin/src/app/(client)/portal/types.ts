import type { ClientRef, ClientThreadMessageRow, TicketRow } from "@/lib/dto";
import type { FeatureTicket } from "@/lib/features";
import type { AbsenceMode } from "@/lib/types";

// Ce que le portail reçoit d'un épic : ni estimation, ni responsable (CC-374).
export type PortalEpic = {
  id: string;
  title: string;
  objective: string | null;
  dueAt: Date | null;
  // Les tickets de l'épic, dans l'ordre de leur numérotation (CC-365).
  tickets: FeatureTicket[];
};

// `others` : les tickets hors épic (CC-374), sans description.
export type PortalProgressScreen = { epics: PortalEpic[]; others: FeatureTicket[] };

// Tickets remontés par le client uniquement : le travail interne de l'agence
// sur le projet ne lui est pas exposé.
export type PortalBugsScreen = { tickets: TicketRow[] };

export type PortalMessagesScreen = {
  messages: ClientThreadMessageRow[];
  // Seul le nom de la cheffe de projet est exposé.
  pm: { id: string; name: string } | null;
  // Réponse automatique active, s'il y en a une.
  absence: { mode: AbsenceMode; message: string | null } | null;
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

// Un seul des deux volets est rempli, selon l'onglet demandé.
export type PortalProjectScreen = {
  tab: "features" | "cdc";
  epics: PortalEpic[];
  docs: PortalCdcDocRow[];
};

export type { ClientRef };
