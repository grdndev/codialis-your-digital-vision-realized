import type { ClientRef, ProjectWithClient, TaskRow, UserRef } from "@/lib/dto";
import type { ClientQuestionStatus } from "@/lib/types";

export type ProjectsScreen = { allProjects: ProjectWithClient[] };

export type TaskWithAssignee = TaskRow & { assignee: UserRef | null };

export type EpicWithTasks = {
  id: string;
  projectId: string;
  title: string;
  objective: string | null;
  estHours: number;
  leadId: string | null;
  dueAt: Date | null;
  order: number;
  createdAt: Date;
  lead: UserRef | null;
  tasks: TaskWithAssignee[];
};

type DetailClient = ClientRef & {
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export type ProjectDetail = Omit<ProjectWithClient, "client"> & {
  client: DetailClient;
  epics: EpicWithTasks[];
};

export type ApiCredentialRow = {
  id: string;
  projectId: string;
  name: string;
  role: string;
  env: string;
  baseUrl: string;
  maskedKey: string;
  authType: string;
  ownerId: string | null;
  expiryNote: string;
  order: number;
};

export type ClientQuestionRow = {
  id: string;
  projectId: string;
  question: string;
  status: ClientQuestionStatus;
  answer: string;
  askedAt: Date | null;
  answeredAt: Date | null;
  createdAt: Date;
};

// `access` sépare les deux écrans vides possibles : projet inexistant (404) et
// développeur non assigné (message explicite). `apis` et `questions` n'arrivent
// remplis que si l'onglet Fiche est demandé.
export type ProjectDetailResponse =
  | { access: "not-found" }
  | { access: "not-assigned" }
  | {
      access: "ok";
      project: ProjectDetail;
      team: { id: string; name: string }[];
      apis: ApiCredentialRow[];
      questions: ClientQuestionRow[];
    };

export type TaskCriterionRow = {
  id: string;
  taskId: string;
  label: string;
  done: boolean;
  order: number;
};

export type TaskCommentRow = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  author: UserRef;
};

export type TaskAttachmentRow = {
  id: string;
  taskId: string;
  filename: string;
  meta: string;
  createdAt: Date;
};

export type TaskDetail = TaskRow & {
  epic: { id: string; title: string; projectId: string; project: ProjectWithClient };
  assignee: UserRef | null;
  criteria: TaskCriterionRow[];
  comments: TaskCommentRow[];
  attachments: TaskAttachmentRow[];
};

export type TaskDetailResponse = { task: TaskDetail | null };
