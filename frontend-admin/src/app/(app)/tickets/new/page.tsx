import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { NewTicketForm } from "./new-ticket-form";
import type { NewTicketScreen } from "../types";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  // Les listes arrivent déjà mises en forme pour les sélecteurs.
  const { projects, team } = await apiGet<NewTicketScreen>("/api/admin/tickets/new");
  // Venu de la fiche d'un projet, le sélecteur s'ouvre déjà sur celui-ci.
  const { project } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Nouveau ticket</h1>
        <p className="mt-1 text-sm text-muted">Créé par {user.name}</p>
      </div>
      <NewTicketForm projects={projects} team={team} initialProjectId={project} />
    </div>
  );
}
