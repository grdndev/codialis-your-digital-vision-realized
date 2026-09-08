import type { ProjectWithClient, UserRef } from "@/lib/dto";
import type { CategoryFormat, CategoryVisibility, MockupStatus } from "@/lib/types";

export type ApiRow = {
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
  owner: UserRef | null;
};

export type UrlRow = {
  id: string;
  projectId: string;
  env: string;
  url: string;
  access: string;
  deployNote: string;
  order: number;
};

export type TestAccountRow = {
  id: string;
  projectId: string;
  role: string;
  login: string;
  passwordMasked: string;
  env: string;
  note: string;
  order: number;
};

export type MockupRow = {
  id: string;
  projectId: string;
  name: string;
  version: string;
  status: MockupStatus;
  updatedAt: Date;
};

export type MockupSourceRow = {
  id: string;
  projectId: string;
  label: string;
  url: string;
  status: string;
};

export type CdcDocRow = {
  id: string;
  projectId: string;
  name: string;
  version: string;
  meta: string;
  status: string;
  sections: string;
  order: number;
};

export type TechDocRow = {
  id: string;
  projectId: string;
  name: string;
  ext: string;
  meta: string;
  status: string;
  order: number;
};

export type CustomCategoryRowRow = {
  id: string;
  categoryId: string;
  // JSON : un tableau de valeurs, dans l'ordre des colonnes de la catégorie.
  data: string;
  order: number;
};

export type CustomCategoryRow = {
  id: string;
  projectId: string;
  name: string;
  visibility: CategoryVisibility;
  format: CategoryFormat;
  // JSON : le tableau des noms de colonnes.
  columns: string;
  authorId: string;
  createdAt: Date;
  rows: CustomCategoryRowRow[];
};

// Seules les ressources de l'onglet ouvert sont chargées. `custom` n'a pas de
// charge propre : les lignes d'une catégorie personnalisée sont déjà dans
// `customCategories`.
export type ResourcePanel =
  | { kind: "api"; apis: ApiRow[] }
  | { kind: "url"; urls: UrlRow[] }
  | { kind: "acc"; accounts: TestAccountRow[] }
  | { kind: "mock"; mockups: MockupRow[]; sources: MockupSourceRow[] }
  | { kind: "doc"; cdc: CdcDocRow[]; techDocs: TechDocRow[] }
  | { kind: "custom" };

export type ResourcesScreen = {
  // Déjà restreint au périmètre du rôle.
  projects: ProjectWithClient[];
  // Projet et onglet résolus par l'API. `null` quand l'utilisateur n'a aucun projet.
  activeProjectId: string | null;
  activeTab: string;
  customCategories: CustomCategoryRow[];
  team: { id: string; name: string }[];
  panel: ResourcePanel | null;
};
