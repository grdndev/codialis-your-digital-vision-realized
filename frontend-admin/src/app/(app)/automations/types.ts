import type { AbsenceMode, AutomationMode, DraftStatus } from "@/lib/types";

export type AbsenceSettingRow = {
  id: string;
  pmId: string;
  mode: AbsenceMode;
  enabled: boolean;
  rangeLabel: string;
  substituteId: string | null;
  nextAbsence: string;
  updatedAt: Date;
};

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
  // Null si personne n'a encore réglé d'absence.
  absence: AbsenceSettingRow | null;
  autoRules: AutomationRuleRow[];
  drafts: AutomationDraftRow[];
  signals: AutomationSignalRow[];
  sentCount: number;
  ignoredCount: number;
  paidInvoices: PaidInvoiceDelay[];
};

export type AutomationDraftText = { text: string; source: "gemini" | "template" };
