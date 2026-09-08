import type {
  ActionCategory,
  ProjectGroup,
  Role,
  TaskStatus,
  TicketType,
  Severity,
  DevNature,
  TriageState,
} from "@/lib/types";

// Formes renvoyées par l'API admin, écrites à la main.
//
// C'est le contrat entre les deux applications. Il est déclaré ici plutôt que
// dérivé de Prisma parce que frontend-admin n'a pas accès au client généré :
// écrire la forme attendue rend le contrat explicite et fait échouer le
// typecheck si le backend cesse de l'honorer.
//
// Les champs `DateTime` de Prisma voyagent en chaînes ISO et sont reconstruits
// en `Date` à la lecture (voir le reviver de src/lib/api.ts) — ils sont donc
// bien typés `Date` ici.

export type ClientRef = { id: string; name: string };

export type UserRef = { id: string; name: string; initials: string; role: Role };

export type ProjectRow = {
  id: string;
  clientId: string;
  name: string;
  initials: string;
  group: ProjectGroup;
  phaseLabel: string;
  description: string;
  hoursSold: number;
  hoursSpent: number;
  progressPct: number;
  openedAt: Date;
  closedAt: Date | null;
  deadlineAt: Date | null;
  deadlineNote: string | null;
  lastActivityAt: Date;
  soldAmount: number | null;
  costAmount: number | null;
};

export type ProjectWithClient = ProjectRow & { client: ClientRef };

export type TicketRow = {
  id: string;
  ref: string;
  projectId: string;
  epicId: string | null;
  type: TicketType;
  severity: Severity | null;
  devNature: DevNature | null;
  status: TaskStatus;
  title: string;
  description: string;
  steps: string;
  module: string | null;
  estHours: number;
  spentHours: number;
  assigneeId: string | null;
  creatorId: string | null;
  clientReported: boolean;
  triageState: TriageState;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskRow = {
  id: string;
  epicId: string;
  title: string;
  description: string;
  status: TaskStatus;
  estHours: number;
  spentHours: number;
  assigneeId: string | null;
  dueAt: Date | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ActionItemRow = {
  id: string;
  category: ActionCategory;
  tag: string;
  title: string;
  detail: string;
  dueLabel: string;
  amountLabel: string;
  ctaLabel: string;
  done: boolean;
  linkedProjectId: string | null;
  linkedProject: (ProjectRow & { client: ClientRef }) | null;
  createdAt: Date;
};

export type InternalTaskRow = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string;
  assignerId: string;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
