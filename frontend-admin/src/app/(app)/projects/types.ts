import type { ClientRef, ProjectWithClient, TicketRow, UserRef } from "@/lib/dto";
import type { ClientQuestionStatus } from "@/lib/types";

export type ProjectsScreen = {
  allProjects: ProjectWithClient[];
  clients: ClientRef[];
};

// Un épic du projet. Ses tickets ne sont pas imbriqués : ils arrivent avec ceux
// du projet (`tickets`), et l'écran les range sous leur épic.
export type ProjectEpic = {
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
};

type DetailClient = ClientRef & {
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export type ProjectDetail = Omit<ProjectWithClient, "client"> & {
  client: DetailClient;
  epics: ProjectEpic[];
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

// `access` distingue deux écrans vides : le projet n'existe pas, ou il n'est pas
// ouvert au développeur qui l'appelle — aucun ticket ne lui y est assigné.
// `apis` et `questions` n'arrivent remplis que si l'onglet Fiche est demandé.
export type ProjectDetailResponse =
  | { access: "not-found" }
  | { access: "forbidden" }
  | {
      access: "ok";
      project: ProjectDetail;
      team: { id: string; name: string }[];
      apis: ApiCredentialRow[];
      questions: ClientQuestionRow[];
      // Tout le travail du projet, dans un épic ou non, toutes vues confondues.
      tickets: ProjectTicketRow[];
      clients: ClientRef[];
    };

export type ProjectTicketRow = TicketRow & {
  assignee: UserRef | null;
  epic: { id: string; title: string } | null;
};
