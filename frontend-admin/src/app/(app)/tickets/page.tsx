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
} from "@/lib/format";
import type { TaskStatus } from "@/lib/types";
import type { TicketsScreen } from "./types";

const STATUSES: TaskStatus[] = ["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"];

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; type?: string; status?: string; view?: string }>;
}) {
  // Le cloisonnement par rôle est appliqué côté API : ici la garde ne sert
  // qu'à exiger une session.
  await requireUser();
  const sp = await searchParams;
  const view = sp.view === "kanban" ? "kanban" : "table";

  // Les filtres partent en paramètres de requête : le cloisonnement par rôle
  // (un développeur ne voit que ses projets) est appliqué côté API, pas ici.
  const filters = new URLSearchParams();
  if (sp.project) filters.set("project", sp.project);
  if (sp.type) filters.set("type", sp.type);
  if (sp.status) filters.set("status", sp.status);
  const { projects, tickets } = await apiGet<TicketsScreen>(`/api/admin/tickets?${filters}`);

  const bugCount = tickets.filter((t) => t.type === "BUG").length;
  const devCount = tickets.filter((t) => t.type === "DEV").length;
  const remaining = tickets.reduce((s, t) => s + Math.max(0, t.estHours - t.spentHours), 0);

  function withParam(key: string, value: string | null) {
    const params = new URLSearchParams();
    if (sp.project) params.set("project", sp.project);
    if (sp.type) params.set("type", sp.type);
    if (sp.status) params.set("status", sp.status);
    if (sp.view) params.set("view", sp.view);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    return qs ? `/tickets?${qs}` : "/tickets";
  }

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
            <Link href={withParam("view", null)} className={`rounded-md px-3 py-1.5 ${view === "table" ? "bg-mint/10 text-mint" : "text-muted"}`}>
              Tableau
            </Link>
            <Link href={withParam("view", "kanban")} className={`rounded-md px-3 py-1.5 ${view === "kanban" ? "bg-mint/10 text-mint" : "text-muted"}`}>
              Kanban
            </Link>
          </div>
          <Link href="/tickets/new" className="rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">
            + Nouveau ticket
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <FilterLink href={withParam("project", null)} active={!sp.project}>
          Tous les projets
        </FilterLink>
        {projects.map((p) => (
          <FilterLink key={p.id} href={withParam("project", p.id)} active={sp.project === p.id}>
            {p.client.name}
          </FilterLink>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <FilterLink href={withParam("type", null)} active={!sp.type}>
          Tous types
        </FilterLink>
        <FilterLink href={withParam("type", "BUG")} active={sp.type === "BUG"}>
          Bugs
        </FilterLink>
        <FilterLink href={withParam("type", "DEV")} active={sp.type === "DEV"}>
          Développement
        </FilterLink>
        <span className="mx-1 h-4 w-px bg-border" />
        <FilterLink href={withParam("status", null)} active={!sp.status}>
          Tous statuts
        </FilterLink>
        {STATUSES.map((s) => (
          <FilterLink key={s} href={withParam("status", s)} active={sp.status === s}>
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
                  {items.map((t) => (
                    <Link
                      key={t.id}
                      href={`/tickets/${t.ref}`}
                      className="rounded-lg border border-border bg-panel-2 p-3 text-sm transition hover:border-mint/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted">{t.ref}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TICKET_TYPE_BADGE_CLASS[t.type]}`}>
                          {TICKET_TYPE_LABEL[t.type]}
                        </span>
                      </div>
                      <p className="mt-1 text-text">{t.title}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted">
                        <span>{t.project.client.name}</span>
                        <span>{fmtHours(t.estHours)}</span>
                      </div>
                    </Link>
                  ))}
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
