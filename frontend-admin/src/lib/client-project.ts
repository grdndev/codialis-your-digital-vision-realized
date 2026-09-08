import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

// Le projet du client connecté — l'unité de contexte de tout le portail.
// `cache()` déduplique : le layout et la page l'utilisent tous les deux, mais
// le backend n'est interrogé qu'une fois par requête.

export type PortalProject = {
  id: string;
  name: string;
  initials: string;
  phaseLabel: string;
  progressPct: number;
  deadlineAt: Date | null;
  deadlineNote: string | null;
  lastActivityAt: Date;
  client: { id: string; name: string };
};

const fetchProject = cache(async () => {
  const { project } = await apiGet<{ project: PortalProject | null }>(
    "/api/admin/client/context",
    "/portal",
  );
  return project;
});

export async function requireClientProject(): Promise<{
  user: SessionUser;
  project: PortalProject;
}> {
  const user = await requireRole("CLIENT");
  const project = await fetchProject();
  // Un compte client sans projet affecté n'a rien à afficher : c'est une
  // anomalie de configuration, pas un état normal du portail.
  if (!project) notFound();
  return { user, project };
}
