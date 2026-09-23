import type { ClientRef, UserRef } from "@/lib/dto";
import type { DealStage } from "@/lib/types";

export type DealNoteRow = {
  id: string;
  dealId: string;
  authorId: string | null;
  body: string;
  createdAt: Date;
  author: UserRef | null;
};

export type DealRow = {
  id: string;
  name: string;
  stage: DealStage;
  amount: number;
  order: number;
  note: string;
  nextAction: string;
  probabilityPct: number;
  contactFirst: string | null;
  contactLast: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  source: string | null;
  description: string;
  devHours: number | null;
  hourlyRate: number | null;
  lossReason: string | null;
  lossDetail: string | null;
  lostAt: Date | null;
  lostBy: string | null;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
  notes: DealNoteRow[];
};

export type CrmScreen = {
  deals: DealRow[];
  // Pour rattacher une affaire signée à un client déjà connu plutôt que d'en
  // créer un doublon.
  clients: ClientRef[];
  // Déjà résolu côté API : la valeur enregistrée, ou le défaut de l'agence.
  quarterlyTarget: number;
};

// Résultat d'un import CSV : soit un refus du fichier entier, soit le compte des
// lignes retenues et ignorées.
export type CsvImportResult = {
  error?: "empty" | "header";
  imported?: number;
  skipped?: number;
};
