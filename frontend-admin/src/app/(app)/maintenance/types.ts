import type { ClientRef, ProjectWithClient } from "@/lib/dto";

export type MaintenanceContractRow = {
  id: string;
  projectId: string;
  monthlyPrice: number;
  includedHours: number;
  usedHoursThisMonth: number;
  renewalNote: string;
  project: { id: string; name: string; maintenanceEndsAt: Date | null; client: ClientRef };
};

export type MaintenanceScreen = {
  // Date de fin de garantie posée, ou phase « Sous garantie » ; triés par
  // échéance, les projets sans date à la fin.
  warranty: ProjectWithClient[];
  contracts: MaintenanceContractRow[];
  // Sous maintenance (date ou phase) mais sans contrat enregistré.
  maintained: ProjectWithClient[];
};
