import type { ClientRef, ProjectWithClient } from "@/lib/dto";
import type { InvoiceStatus } from "@/lib/types";

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
  project: { id: string; name: string; client: ClientRef };
};

// `activeProjects` est filtré côté API sur soldAmount ET costAmount non nuls
// (l'écran en calcule une marge), d'où les nombres non optionnels ici.
export type FinanceProject = Omit<ProjectWithClient, "soldAmount" | "costAmount"> & {
  soldAmount: number;
  costAmount: number;
};

export type FinanceScreen = {
  invoices: InvoiceRow[];
  activeProjects: FinanceProject[];
  projects: ProjectWithClient[];
};
