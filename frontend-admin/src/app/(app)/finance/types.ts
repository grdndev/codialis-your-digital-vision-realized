import type { ClientRef, ProjectWithClient, UserRef } from "@/lib/dto";
import type { InvoiceStatus } from "@/lib/types";

export type InvoiceCommentRow = {
  id: string;
  invoiceId: string;
  authorId: string | null;
  body: string;
  createdAt: Date;
  author: UserRef | null;
};

export type InvoiceRow = {
  id: string;
  projectId: string;
  ref: string;
  label: string;
  amount: number;
  issuedAt: Date;
  dueAt: Date | null;
  paidAt: Date | null;
  status: InvoiceStatus;
  // Rang de l'échéance réglée (0 = acompte) ; null = facture libre.
  milestone: number | null;
  project: { id: string; name: string; client: ClientRef };
  comments: InvoiceCommentRow[];
};

// `activeProjects` est filtré côté API sur soldAmount ET costAmount non nuls
// (l'écran en calcule une marge), d'où les nombres non optionnels ici.
export type FinanceProject = Omit<ProjectWithClient, "soldAmount" | "costAmount"> & {
  soldAmount: number;
  costAmount: number;
};

// Prochaine échéance d'un projet, calculée par l'API (src/lib/billing.ts du
// backend) : l'écran l'annonce, il ne la recalcule pas.
export type NextMilestone =
  | { status: "no-total" }
  | { status: "done" }
  | { status: "next"; index: number; name: string; pct: number; amount: number; label: string };

export type BillingRow = {
  projectId: string;
  total: number | null;
  plan: string;
  steps: { index: number; name: string; pct: number }[];
  planInvoiced: number;
  extraInvoiced: number;
  next: NextMilestone;
};

export type FinanceScreen = {
  invoices: InvoiceRow[];
  activeProjects: FinanceProject[];
  projects: ProjectWithClient[];
  // Un par projet de `projects`.
  billing: BillingRow[];
  planPresets: string[];
  // Taux de l'agence (CC-357) : les heures vendues s'en déduisent.
  rates: { hourlyRate: number; workdayHours: number };
};
