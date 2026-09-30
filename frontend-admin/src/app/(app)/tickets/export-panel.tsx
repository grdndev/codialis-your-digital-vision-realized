import { STATUS_LABEL, projectLabel } from "@/lib/format";
import type { TaskStatus } from "@/lib/types";

const STATUSES: TaskStatus[] = ["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"];

// Bouton « Exporter » et ses paramètres (CC-353), partagés par l'écran Tickets
// et la fiche projet. Un formulaire GET vers /tickets/export : la réponse est
// une pièce jointe, le navigateur la télécharge et reste sur la page.
//
// Statuts et personnes se cochent à plusieurs et se croisent ; rien de coché
// exporte tout. Sur une fiche projet, le projet est imposé.
export function TicketExportPanel({
  people,
  projects,
  projectId,
}: {
  people: { id: string; name: string }[];
  // Liste proposée sur l'écran Tickets ; absente sur une fiche projet.
  projects?: { id: string; name: string; client: { name: string } }[];
  projectId?: string;
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted transition hover:text-text">
        Exporter
      </summary>
      <form
        method="get"
        action="/tickets/export"
        className="absolute right-0 z-10 mt-2 flex w-[26rem] flex-col gap-3 rounded-xl border border-border bg-panel p-4 text-xs shadow-2xl"
      >
        <fieldset className="flex items-center gap-4">
          <legend className="mb-1.5 font-medium text-muted">Format</legend>
          <label className="flex items-center gap-1.5 text-text">
            <input type="radio" name="format" value="csv" defaultChecked className="accent-mint" /> CSV (tableur)
          </label>
          <label className="flex items-center gap-1.5 text-text">
            <input type="radio" name="format" value="json" className="accent-mint" /> JSON
          </label>
        </fieldset>

        {projectId ? (
          <input type="hidden" name="project" value={projectId} />
        ) : projects ? (
          <label className="flex flex-col gap-1.5 font-medium text-muted">
            Projet
            <select name="project" defaultValue="" className="input text-xs">
              <option value="">Tous les projets</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {projectLabel(p.client.name, p.name)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <fieldset>
          <legend className="mb-1.5 font-medium text-muted">Statuts</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-text">
                <input type="checkbox" name="status" value={s} className="accent-mint" /> {STATUS_LABEL[s]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 font-medium text-muted">Personnes assignées</legend>
          <div className="flex max-h-32 flex-wrap gap-x-4 gap-y-1.5 overflow-y-auto">
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-text">
                <input type="checkbox" name="assignee" value={p.id} className="accent-mint" /> {p.name}
              </label>
            ))}
            <label className="flex items-center gap-1.5 text-text">
              <input type="checkbox" name="assignee" value="none" className="accent-mint" /> Non assigné
            </label>
          </div>
        </fieldset>

        <p className="text-muted">Rien de coché : tous les tickets{projectId ? " du projet" : ""} sont exportés.</p>
        <button type="submit" className="rounded-lg bg-mint px-3 py-2 font-semibold text-bg">
          Télécharger
        </button>
      </form>
    </details>
  );
}
