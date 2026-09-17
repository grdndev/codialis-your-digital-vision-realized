import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import {
  fmtHours,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  TICKET_TYPE_BADGE_CLASS,
  TICKET_TYPE_LABEL,
  SEVERITY_BADGE_CLASS,
  SEVERITY_LABEL,
  DEV_NATURE_LABEL,
  projectLabel,
} from "@/lib/format";
import type { Severity, TaskStatus } from "@/lib/types";
import { setTicketStatusAction } from "./actions";
import type { TicketsScreen } from "./types";

const STATUSES: TaskStatus[] = ["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"];
const FILTER_KEYS = ["project", "type", "severity", "status"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
// L'API renvoie déjà la liste triée du plus grave au moins grave.
const SEVERITIES: Severity[] = ["BLOQUANT", "MAJEUR", "MINEUR"];

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    project?: string;
    type?: string;
    status?: string;
    severity?: string;
    view?: string;
    f?: string;
  }>;
}) {
  // Le cloisonnement par rôle est appliqué côté API : ici la garde ne sert
  // qu'à exiger une session.
  const user = await requireUser();
  // Un développeur va jusqu'à « En revue » : la clôture appartient à la
  // chefferie de projet et à la direction.
  const canClose = user.role !== "DEV";
  const sp = await searchParams;
  const view = sp.view === "kanban" ? "kanban" : "table";

  // Les filtres partent en paramètres de requête : le cloisonnement par rôle
  // (un développeur ne voit que ses projets) est appliqué côté API, pas ici.
  const filters = new URLSearchParams();
  if (sp.project) filters.set("project", sp.project);
  if (sp.type) filters.set("type", sp.type);
  if (sp.status) filters.set("status", sp.status);
  if (sp.severity) filters.set("severity", sp.severity);
  const { projects, tickets } = await apiGet<TicketsScreen>(`/api/admin/tickets?${filters}`);

  const bugCount = tickets.filter((t) => t.type === "BUG").length;
  const devCount = tickets.filter((t) => t.type === "DEV").length;
  const remaining = tickets.reduce((s, t) => s + Math.max(0, t.estHours - t.spentHours), 0);

  // Chaque critère retient plusieurs valeurs : cliquer une deuxième gravité
  // l'ajoute au lieu de remplacer la première, recliquer l'enlève. `f=1`
  // marque un choix délibéré — c'est ce qui distingue « aucun filtre » d'une
  // arrivée par le menu, où les filtres retenus sont réappliqués.
  function selected(key: FilterKey): string[] {
    return (sp[key] ?? "").split(",").filter(Boolean);
  }

  function buildHref(next: Partial<Record<FilterKey | "view", string | null>>) {
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = key in next ? next[key] : (sp[key] ?? null);
      if (value) params.set(key, value);
    }
    const view = "view" in next ? next.view : (sp.view ?? null);
    if (view) params.set("view", view);
    params.set("f", "1");
    return `/tickets?${params}`;
  }

  function toggleHref(key: FilterKey, value: string) {
    const current = selected(key);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    return buildHref({ [key]: next.join(",") || null });
  }

  const clearHref = (key: FilterKey) => buildHref({ [key]: null });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Tickets</h1>
          <p className="mt-1 text-sm text-muted">
            {bugCount} bugs · {devCount} développement · {fmtHours(remaining)} restant estimé
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg border border-border bg-panel p-1 text-sm">
            <Link href={buildHref({ view: null })} className={`rounded-md px-3 py-1.5 ${view === "table" ? "bg-mint/10 text-mint" : "text-muted"}`}>
              Tableau
            </Link>
            <Link href={buildHref({ view: "kanban" })} className={`rounded-md px-3 py-1.5 ${view === "kanban" ? "bg-mint/10 text-mint" : "text-muted"}`}>
              Kanban
            </Link>
          </div>
          <Link href="/tickets/new" className="rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">
            + Nouveau ticket
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <FilterLink href={clearHref("project")} active={!selected("project").length}>
          Tous les projets
        </FilterLink>
        {projects.map((p) => (
          <FilterLink
            key={p.id}
            href={toggleHref("project", p.id)}
            active={selected("project").includes(p.id)}
          >
            {projectLabel(p.client.name, p.name)}
          </FilterLink>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <FilterLink href={clearHref("type")} active={!selected("type").length}>
          Tous types
        </FilterLink>
        <FilterLink href={toggleHref("type", "BUG")} active={selected("type").includes("BUG")}>
          Bugs
        </FilterLink>
        <FilterLink href={toggleHref("type", "DEV")} active={selected("type").includes("DEV")}>
          Développement
        </FilterLink>
        <span className="mx-1 h-4 w-px bg-border" />
        <FilterLink href={clearHref("severity")} active={!selected("severity").length}>
          Toutes gravités
        </FilterLink>
        {SEVERITIES.map((sev) => (
          <FilterLink
            key={sev}
            href={toggleHref("severity", sev)}
            active={selected("severity").includes(sev)}
          >
            {SEVERITY_LABEL[sev]}
          </FilterLink>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <FilterLink href={clearHref("status")} active={!selected("status").length}>
          Tous statuts
        </FilterLink>
        {STATUSES.map((s) => (
          <FilterLink
            key={s}
            href={toggleHref("status", s)}
            active={selected("status").includes(s)}
          >
            {STATUS_LABEL[s]}
          </FilterLink>
        ))}
        <span className="ml-auto text-muted">{tickets.length} tickets</span>
      </div>

      {view === "table" ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-panel">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Réf.</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Titre</th>
                <th className="px-4 py-3 font-medium">Projet</th>
                <th className="px-4 py-3 font-medium">Gravité · nature</th>
                <th className="px-4 py-3 font-medium">Assigné</th>
                <th className="px-4 py-3 font-medium">Estimé</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((t) => (
                <tr key={t.id} className="transition hover:bg-panel-2">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={`/tickets/${t.ref}`} className="font-medium text-text hover:text-mint">
                      {t.ref}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_TYPE_BADGE_CLASS[t.type]}`}>
                      {TICKET_TYPE_LABEL[t.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.ref}`} className="text-text hover:text-mint">
                      {t.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{t.project.client.name}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {t.severity ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE_CLASS[t.severity]}`}>
                        {SEVERITY_LABEL[t.severity]}
                      </span>
                    ) : t.devNature ? (
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-muted">
                        {DEV_NATURE_LABEL[t.devNature]}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{t.assignee?.name ?? "Non assigné"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtHours(t.estHours)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">
                    Aucun ticket pour ces filtres.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {STATUSES.map((s) => {
            const items = tickets.filter((t) => t.status === s);
            const hours = items.reduce((sum, t) => sum + t.estHours, 0);
            return (
              <div key={s} className="rounded-xl border border-border bg-panel">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-sm font-medium text-text">{STATUS_LABEL[s]}</span>
                  <span className="text-xs text-muted">
                    {items.length} · {fmtHours(hours)}
                  </span>
                </div>
                <div className="flex flex-col gap-2 p-3">
                  {items.map((t) => {
                    const col = STATUSES.indexOf(t.status);
                    return (
                      <div
                        key={t.id}
                        className="rounded-lg border border-border bg-panel-2 p-3 text-sm transition hover:border-mint/40"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted">{t.ref}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TICKET_TYPE_BADGE_CLASS[t.type]}`}>
                            {TICKET_TYPE_LABEL[t.type]}
                          </span>
                        </div>
                        <Link href={`/tickets/${t.ref}`} className="mt-1 block text-text hover:text-mint">
                          {t.title}
                        </Link>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted">
                          <span>{t.project.client.name}</span>
                          <span>{fmtHours(t.estHours)}</span>
                        </div>
                        {/* Déplacer la carte d'une colonne : sans cela le kanban
                            ne sert qu'à regarder. */}
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                          <MoveButton
                            ticketId={t.id}
                            to={STATUSES[col - 1]}
                            label="‹"
                            title={col > 0 ? `Vers « ${STATUS_LABEL[STATUSES[col - 1]]} »` : ""}
                          />
                          <MoveButton
                            ticketId={t.id}
                            to={canClose || STATUSES[col + 1] !== "TERMINE" ? STATUSES[col + 1] : undefined}
                            label="›"
                            title={
                              !canClose && STATUSES[col + 1] === "TERMINE"
                                ? "La clôture revient à la chefferie de projet ou à la direction"
                                : col < STATUSES.length - 1
                                  ? `Vers « ${STATUS_LABEL[STATUSES[col + 1]]} »`
                                  : ""
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 ? <p className="px-1 py-2 text-xs text-muted">—</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Une colonne inexistante (bord du tableau) rend un bouton inerte plutôt que
// rien : les cartes gardent la même hauteur d'une colonne à l'autre.
function MoveButton({
  ticketId,
  to,
  label,
  title,
}: {
  ticketId: string;
  to: TaskStatus | undefined;
  label: string;
  title: string;
}) {
  if (!to) {
    return <span className="px-2 py-0.5 text-xs text-muted/30">{label}</span>;
  }
  return (
    <form action={setTicketStatusAction.bind(null, ticketId, to, false)}>
      <button
        type="submit"
        title={title}
        className="rounded-md border border-border px-2 py-0.5 text-xs text-muted transition hover:border-mint/40 hover:text-mint"
      >
        {label}
      </button>
    </form>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-2.5 py-1 transition ${
        active ? "border-mint/40 bg-mint/10 text-text" : "border-border text-muted hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}
