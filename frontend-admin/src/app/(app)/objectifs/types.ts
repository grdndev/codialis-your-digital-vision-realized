// Objectif (CC-347, CC-356). `project` est null quand l'objectif n'en suit
// aucun, ou quand la personne connectée ne peut pas ouvrir ce projet.
// `outcome` null = encore en cours ; sinon le constat, daté par `closedAt`.
export type GoalOutcome = "ATTEINT" | "NON_ATTEINT";

export type GoalRow = {
  id: string;
  title: string;
  detail: string;
  dueAt: Date;
  projectId: string | null;
  outcome: GoalOutcome | null;
  outcomeNote: string | null;
  closedAt: Date | null;
  createdAt: Date;
  author: { name: string } | null;
  project: {
    id: string;
    name: string;
    progressPct: number;
    hoursSpent: number;
    hoursSold: number;
    deadlineAt: Date | null;
    client: { name: string };
  } | null;
};

export type GoalProject = { id: string; name: string; client: { name: string } };

export type ObjectifsScreen = {
  goals: GoalRow[];
  // Projets rattachables à un objectif ; vide hors direction.
  projects: GoalProject[];
};
