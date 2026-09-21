import type { ClientRef, ProjectWithClient, TaskRow, TicketRow, UserRef } from "@/lib/dto";
import type { ClientQuestionStatus } from "@/lib/types";

export type ProjectsScreen = {
  allProjects: ProjectWithClient[];
  clients: ClientRef[];
};

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

// `access` ne distingue plus qu'un cas d'écran vide : le projet n'existe pas.
// Toute l'équipe interne voit tous les projets. `apis` et `questions`
// n'arrivent remplis que si l'onglet Fiche est demandé.
export type ProjectDetailResponse =
  | { access: "not-found" }
  | {
      access: "ok";
      project: ProjectDetail;
      team: { id: string; name: string }[];
      apis: ApiCredentialRow[];
      questions: ClientQuestionRow[];
      // Les bugs et développements rattachés au projet, toutes vues confondues.
      tickets: ProjectTicketRow[];
      clients: ClientRef[];
    };

export type ProjectTicketRow = TicketRow & {
  assignee: UserRef | null;
  epic: { id: string; title: string } | null;
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

export type TaskDetailResponse = {
  task: TaskDetail | null;
  // Pour le formulaire de modification : les lots du projet et l'équipe.
  epics?: { id: string; title: string }[];
  team?: { id: string; name: string }[];
};
