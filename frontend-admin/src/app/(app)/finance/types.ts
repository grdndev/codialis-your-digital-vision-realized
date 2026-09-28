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
  project: { id: string; name: string; client: ClientRef };
  comments: InvoiceCommentRow[];
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
