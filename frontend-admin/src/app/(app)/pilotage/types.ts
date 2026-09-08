import type { ProjectWithClient, UserRef } from "@/lib/dto";
import type { InvoiceStatus } from "@/lib/types";
import type { DealRow } from "../crm/types";

export type CashForecastItemRow = {
  id: string;
  monthLabel: string;
  label: string;
  amount: number;
  whenLabel: string;
  sure: boolean;
  order: number;
};

export type TeamProfitRow = {
  id: string;
  userId: string;
  period: string;
  billableHours: number;
  internalHours: number;
  billableRatePct: number;
  cost: number;
  revenue: number;
  marginPct: number;
  note: string;
  user: UserRef;
};

export type DecisionRow = {
  id: string;
  date: Date;
  authorId: string;
  title: string;
  detail: string;
  impact: string;
  tag: string;
  createdAt: Date;
  author: UserRef;
};

// Factures sans relation projet : l'écran n'en somme que les montants.
export type PilotageInvoice = {
  id: string;
  ref: string;
  label: string;
  amount: number;
  issuedAt: Date;
  dueAt: Date | null;
  paidAt: Date | null;
  status: InvoiceStatus;
};

// `projects` est filtré côté API sur soldAmount non nul (concentration client).
export type PilotageProject = Omit<ProjectWithClient, "soldAmount"> & { soldAmount: number };

export type PilotageScreen = {
  cashItems: CashForecastItemRow[];
  teamProfit: TeamProfitRow[];
  projects: PilotageProject[];
  deals: DealRow[];
  decisions: DecisionRow[];
  // Déjà résolus côté API : la valeur enregistrée, ou le défaut de l'agence.
  monthlyCharges: number;
  monthlyRevenueTarget: number;
  paidThisMonth: PilotageInvoice[];
  overdueInvoices: PilotageInvoice[];
};
