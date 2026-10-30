import Link from "next/link";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { projectLabel } from "@/lib/format";
import { NewTicketForm } from "./new-ticket-form";
import type { NewTicketScreen } from "../types";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; cree?: string }>;
}) {
  const user = await requireUser();
  // Venu de la fiche d'un projet, le sélecteur s'ouvre déjà sur celui-ci.
  const { project, cree } = await searchParams;
  // L'API écarte les projets clôturés ; on lui nomme celui d'où l'on vient
  // pour qu'elle le garde même clôturé (sa fiche propose « + Nouveau ticket »).
  const query = new URLSearchParams(project ? { project } : {});
  const screen = await apiGet<NewTicketScreen>(`/api/admin/tickets/new?${query}`);
  const projects = screen.projects.map((p) => ({
    id: p.id,
    label: projectLabel(p.client.name, p.name),
    epics: p.epics,
  }));
  const { team } = screen;
  // Le projet d'où l'on vient : il sert à revenir ici après la création, pour
  // enchaîner les signalements sans repasser par la fiche projet.
  const projetSource = projects.find((p) => p.id === project);

  return (
    <div className="flex flex-col gap-6">
      <div>
        {projetSource ? (
          <Link href={`/projects/${projetSource.id}`} className="text-sm text-muted hover:text-text">
            ← {projetSource.label}
          </Link>
        ) : null}
        <h1 className="mt-1 text-xl font-semibold text-text">Nouveau ticket</h1>
        <p className="mt-1 text-sm text-muted">Créé par {user.name}</p>
      </div>

      {cree ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-mint/30 bg-mint/5 px-4 py-2.5 text-sm">
          <span className="text-text">Ticket {cree} créé.</span>
          <Link href={`/tickets/${cree}`} className="font-medium text-mint hover:brightness-110">
            Voir le ticket
          </Link>
          <span className="text-muted">— le formulaire ci-dessous est prêt pour le suivant.</span>
        </div>
      ) : null}

      <NewTicketForm
        projects={projects}
        team={team}
        initialProjectId={project}
        fromProjectId={projetSource?.id}
      />
    </div>
  );
}
