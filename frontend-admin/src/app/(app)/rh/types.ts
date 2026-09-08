import type { UserRef } from "@/lib/dto";
import type { HrEntryStatus, ShiftKind } from "@/lib/types";

export type OvertimeRow = {
  id: string;
  userId: string;
  date: Date;
  hours: number;
  reason: string;
  status: HrEntryStatus;
  createdAt: Date;
};

export type PlannedShiftRow = {
  id: string;
  userId: string;
  date: Date;
  kind: ShiftKind;
  note: string;
};

export type TravelRow = {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date | null;
  destination: string;
  motif: string;
  status: HrEntryStatus;
  createdAt: Date;
};

// `team`, `allOvertime` et `allTravel` arrivent vides pour un rôle autre que
// DIR : la synthèse d'équipe et la file de validation lui sont réservées.
export type RhScreen = {
  myOvertime: OvertimeRow[];
  myShifts: PlannedShiftRow[];
  myTravel: TravelRow[];
  team: UserRef[];
  allOvertime: (OvertimeRow & { user: UserRef })[];
  allTravel: (TravelRow & { user: UserRef })[];
};
