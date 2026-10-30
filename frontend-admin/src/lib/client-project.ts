import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import type { ProjectGroup, SessionUser } from "@/lib/types";

// Le projet du client connecté — l'unité de contexte de tout le portail.
// `cache()` déduplique : le layout et la page l'utilisent tous les deux, mais
// le backend n'est interrogé qu'une fois par requête.
//
// Un client voit les projets de son entreprise (CC-374). Celui qu'il regarde
// est retenu dans un cookie, posé par le sélecteur du portail ; le backend le
// valide et renvoie le premier projet du client si le cookie désigne autre
// chose. Les écrans passent ensuite `project.id` à leurs routes, l'identifiant
// déjà validé.

export const PORTAL_PROJECT_COOKIE = "codialis_portail_projet";

export type PortalProject = {
  id: string;
  name: string;
  initials: string;
  group: ProjectGroup;
  phaseLabel: string;
  progressPct: number;
  deadlineAt: Date | null;
  deadlineNote: string | null;
  closedAt: Date | null;
  warrantyEndsAt: Date | null;
  maintenanceEndsAt: Date | null;
  lastActivityAt: Date;
  client: { id: string; name: string };
};

export type PortalProjectChoice = { id: string; name: string; group: ProjectGroup };

const fetchContext = cache(async () => {
  const wanted = (await cookies()).get(PORTAL_PROJECT_COOKIE)?.value;
  return apiGet<{ project: PortalProject | null; projects: PortalProjectChoice[] }>(
    `/api/admin/client/context${wanted ? `?project=${encodeURIComponent(wanted)}` : ""}`,
    "/portal",
  );
});

export async function requireClientProject(): Promise<{
  user: SessionUser;
  project: PortalProject;
  projects: PortalProjectChoice[];
}> {
  const user = await requireRole("CLIENT");
  const { project, projects } = await fetchContext();
  // Un compte client dont l'entreprise n'a aucun projet n'a rien à afficher :
  // c'est une anomalie de configuration, pas un état normal du portail.
  if (!project) notFound();
  return { user, project, projects };
}

// Le paramètre à joindre aux routes du portail.
export function portalQuery(project: { id: string }): string {
  return `project=${encodeURIComponent(project.id)}`;
}
