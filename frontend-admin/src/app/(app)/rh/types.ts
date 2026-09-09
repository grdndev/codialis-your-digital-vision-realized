import type { UserRef } from "@/lib/dto";
import type { HrEntryStatus, ShiftKind } from "@/lib/types";

export type HoursEntryKind = "SUP" | "RECUP";
export type AbsenceType = "TELETRAVAIL" | "CONGE" | "ABSENCE" | "FORMATION";
export type HalfDay = "AM" | "PM";
export type RecurrenceEffect = "PRESENT" | "TELETRAVAIL" | "CONGE" | "ABSENCE" | "FORMATION";
export type RecurrenceFreq = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "DAILY";

// Un solde n'est pas stocké en cumul : l'API le recalcule à chaque lecture.
// `defined: false` signifie que la direction n'a jamais saisi de point de
// départ — aucun congé payé ne peut alors être posé.
export type Balance = { defined: boolean; available: number };

export type HoursEntryRow = {
  id: string;
  userId: string;
  kind: HoursEntryKind;
  date: Date;
  hours: number;
  reason: string;
  status: HrEntryStatus;
  // Une heure sup payée est rémunérée : elle n'alimente pas le solde de récup.
  paid: boolean;
  createdAt: Date;
};

export type AbsenceRow = {
  id: string;
  userId: string;
  type: AbsenceType;
  startDate: Date;
  endDate: Date;
  // Ne vaut que sur une absence d'un seul jour.
  halfDay: HalfDay | null;
  motif: string;
  status: HrEntryStatus;
  // Seuls les congés/absences payés décomptent le solde.
  paid: boolean;
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

// Règle de présence récurrente. Elle reste virtuelle : rien n'est écrit dans le
// planning, l'écran la déplie à la volée.
export type PresenceRuleRow = {
  id: string;
  userId: string;
  effect: RecurrenceEffect;
  freq: RecurrenceFreq;
  // 0 = lundi … 6 = dimanche, pour les règles hebdomadaires et bimensuelles.
  weekday: number | null;
  monthday: number | null;
  halfDay: HalfDay | null;
  startDate: Date;
  endDate: Date | null;
  motif: string;
  paid: boolean;
  createdAt: Date;
};

// Le membre d'équipe tel que le voit la direction : les valeurs ANCRÉES (ce
// qu'elle a saisi et quand), à distinguer du disponible calculé.
export type TeamMemberRow = UserRef & {
  leaveAnchorValue: number | null;
  leaveAnchorDate: Date | null;
  hoursAnchorValue: number | null;
  hoursAnchorDate: Date | null;
};

export type TeamBalanceRow = { userId: string; hours: Balance; leave: Balance };

// `team`, `teamBalances`, `allHours`, `allAbsences`, `allTravel` et `allRules`
// arrivent vides pour un rôle autre que DIR : la synthèse d'équipe, les soldes
// des autres et la file de validation lui sont réservés.
export type RhScreen = {
  myHours: HoursEntryRow[];
  myShifts: PlannedShiftRow[];
  myTravel: TravelRow[];
  myAbsences: AbsenceRow[];
  myRules: PresenceRuleRow[];
  balances: { hours: Balance; leave: Balance };
  team: TeamMemberRow[];
  teamBalances?: TeamBalanceRow[];
  allHours: (HoursEntryRow & { user: UserRef })[];
  allTravel: (TravelRow & { user: UserRef })[];
  allAbsences: (AbsenceRow & { user: UserRef })[];
  allRules: (PresenceRuleRow & { user: UserRef })[];
};

export const HOURS_KIND_LABEL: Record<HoursEntryKind, string> = {
  SUP: "Heures supplémentaires",
  RECUP: "Récupération",
};

export const ABSENCE_TYPE_LABEL: Record<AbsenceType, string> = {
  TELETRAVAIL: "Télétravail",
  CONGE: "Congé",
  ABSENCE: "Absence",
  FORMATION: "Formation",
};

export const STATUS_LABEL: Record<HrEntryStatus, string> = {
  DECLARE: "Déclaré",
  VALIDE: "Validé",
  REFUSE: "Refusé",
};

export const STATUS_CLASS: Record<HrEntryStatus, string> = {
  DECLARE: "bg-white/5 text-muted",
  VALIDE: "bg-mint/10 text-mint",
  REFUSE: "bg-red/10 text-red",
};

export const EFFECT_LABEL: Record<RecurrenceEffect, string> = {
  PRESENT: "Présent",
  TELETRAVAIL: "Télétravail",
  CONGE: "Congé",
  ABSENCE: "Absence",
  FORMATION: "Formation",
};

export const FREQ_LABEL: Record<RecurrenceFreq, string> = {
  WEEKLY: "Chaque semaine",
  BIWEEKLY: "Une semaine sur deux",
  MONTHLY: "Chaque mois",
  DAILY: "Tous les jours ouvrés",
};

export const WEEKDAY_LABEL = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
