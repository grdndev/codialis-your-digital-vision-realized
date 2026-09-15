import type { AutomationMode, DraftStatus } from "@/lib/types";

export type AutomationRuleRow = {
  id: string;
  title: string;
  trigger: string;
  mode: AutomationMode;
  channel: string;
  lastRun: string;
  stat: string;
  order: number;
};

export type AutomationDraftRow = {
  id: string;
  toWho: string;
  kind: string;
  text: string;
  status: DraftStatus;
  createdAt: Date;
};

export type AutomationSignalRow = {
  id: string;
  text: string;
  meta: string;
  severity: string;
  order: number;
};

// Seules les factures payées avec une échéance renseignée sont renvoyées : elles
// servent au seul calcul du délai de paiement moyen, d'où les dates non nulles.
export type PaidInvoiceDelay = { id: string; paidAt: Date; dueAt: Date };

export type AutomationsScreen = {
  autoRules: AutomationRuleRow[];
  drafts: AutomationDraftRow[];
  signals: AutomationSignalRow[];
  sentCount: number;
  ignoredCount: number;
  paidInvoices: PaidInvoiceDelay[];
};

export type AutomationDraftText = { text: string; source: "gemini" | "template" };
