import type { ClientRef, ProjectWithClient } from "@/lib/dto";

export type MaintenanceContractRow = {
  id: string;
  projectId: string;
  monthlyPrice: number;
  includedHours: number;
  usedHoursThisMonth: number;
  renewalNote: string;
  project: { id: string; name: string; client: ClientRef };
};

export type MaintenanceScreen = {
  warranty: ProjectWithClient[];
  contracts: MaintenanceContractRow[];
};
