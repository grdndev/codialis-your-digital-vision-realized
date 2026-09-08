import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import type { DashboardScreen } from "./types";
import { fmtHours, fmtDate, daysFromNow, GROUP_BADGE_CLASS, GROUP_LABEL, STATUS_LABEL, STATUS_BADGE_CLASS } from "@/lib/format";
import { assignInternalTaskAction, advanceInternalTaskAction } from "./actions";

export default async function DashboardPage() {
  const user = await requireRole("DIR", "PM");

  const {
    activeProjects,
    openTickets,
    clientCount,
    myInternalTasks,
    pmUsers,
    givenInternalTasks,
    totalProjects,
  } = await apiGet<DashboardScreen>("/api/admin/dashboard");

  const totalSold = activeProjects.reduce((s, p) => s + p.hoursSold, 0);
  const totalSpent = activeProjects.reduce((s, p) => s + p.hoursSpent, 0);
  const overBudget = activeProjects.filter((p) => p.hoursSpent > p.hoursSold);
  const nearDeadline = activeProjects
    .filter((p) => p.deadlineAt)
    .map((p) => ({ p, days: daysFromNow(p.deadlineAt!) }))
    .filter((x) => x.days <= 15)
    .sort((a, b) => a.days - b.days);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Dashboard agence</h1>
        <p className="mt-1 text-sm text-muted">
          Vue d’ensemble des {activeProjects.length} projets actifs
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Projets actifs" value={String(activeProjects.length)} note={`${totalProjects} au total`} />
        <KpiCard label="Heures consommées" value={fmtHours(totalSpent)} note={`sur ${fmtHours(totalSold)} vendues`} />
        <KpiCard label="Tickets ouverts" value={String(openTickets.length)} note="tous projets confondus" />
        <KpiCard label="Clients" value={String(clientCount)} note="comptes actifs" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-xl border border-border bg-panel">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-text">Projets actifs</h2>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {activeProjects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-panel-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">
                    {p.client.name} — {p.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{p.phaseLabel}</p>
                </div>
                <div className="flex w-40 shrink-0 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${p.hoursSpent > p.hoursSold ? "bg-amber" : "bg-mint"}`}
                      style={{ width: `${Math.min(100, p.progressPct)}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-xs text-muted">{p.progressPct}%</span>
                </div>
                <div className="w-28 shrink-0 text-right text-xs text-muted">
                  {fmtHours(p.hoursSpent)} / {fmtHours(p.hoursSold)}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${GROUP_BADGE_CLASS[p.group]}`}
                >
                  {GROUP_LABEL[p.group]}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-panel">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-text">Échéances proches</h2>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {nearDeadline.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">Aucune échéance sous 15 jours.</p>
              ) : (
                nearDeadline.map(({ p, days }) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between px-5 py-3 text-sm transition hover:bg-panel-2"
                  >
                    <span className="truncate text-text">{p.client.name}</span>
                    <span className={`shrink-0 font-medium ${days <= 5 ? "text-red" : "text-amber"}`}>
                      {days <= 0 ? "échu" : `dans ${days} j`}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-text">Dépassements de budget</h2>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {overBudget.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">Aucun projet en dépassement.</p>
              ) : (
                overBudget.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between px-5 py-3 text-sm transition hover:bg-panel-2"
                  >
                    <span className="truncate text-text">{p.client.name}</span>
                    <span className="shrink-0 font-medium text-red">
                      {fmtHours(p.hoursSpent)} / {fmtHours(p.hoursSold)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-panel">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-text">Mes tâches internes</h2>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {myInternalTasks.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">Aucune tâche interne en attente.</p>
            ) : (
              myInternalTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-text">{t.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      confiée par {t.assigner.name}{t.dueAt ? ` · pour le ${fmtDate(t.dueAt)}` : ""}
                    </p>
                    {t.description ? <p className="mt-0.5 text-xs text-muted">{t.description}</p> : null}
                  </div>
                  <form action={advanceInternalTaskAction.bind(null, t.id)} className="shrink-0">
                    <button type="submit" className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[t.status]}`}>
                      {ACTION_LABEL[t.status]}
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>

        {user.role === "DIR" ? (
          <div className="rounded-xl border border-border bg-panel">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-text">Tâches assignées</h2>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {givenInternalTasks.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">Vous n’avez confié aucune tâche interne.</p>
              ) : (
                givenInternalTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-text">{t.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {t.assignee.name}{t.dueAt ? ` · pour le ${fmtDate(t.dueAt)}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </div>
                ))
              )}
            </div>
            <details className="border-t border-border px-5 py-3">
              <summary className="cursor-pointer text-xs font-medium text-mint">+ Assigner une tâche</summary>
              <form action={assignInternalTaskAction} className="mt-2 flex flex-col gap-2">
                <select name="assigneeId" required className="input">
                  <option value="">Assigner à…</option>
                  {pmUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <input name="title" placeholder="Titre (ex : faire une formation)" required className="input" />
                <input name="description" placeholder="Détail (optionnel)" className="input" />
                <input name="dueAt" type="date" className="input" />
                <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Assigner</button>
              </form>
            </details>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  A_FAIRE: "Démarrer",
  EN_COURS: "Passer en revue",
  EN_REVUE: "Marquer terminé",
};

function KpiCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
