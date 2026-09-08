import { apiGet } from "@/lib/api";
import { requireClientProject } from "@/lib/client-project";
import type { PortalProgressScreen } from "./types";
import { fmtDate, daysFromNow } from "@/lib/format";
import { CLIENT_STATE_LABEL, CLIENT_STATE_BADGE_CLASS, movedThisWeek } from "@/lib/features";

export default async function PortalProgressPage() {
  const { project } = await requireClientProject();

  const { epics } = await apiGet<PortalProgressScreen>("/api/admin/client/progress", "/portal");
  const featureEpics = epics.filter((e) => e.tasks.length > 0);
  const allTasks = featureEpics.flatMap((e) => e.tasks);
  const moved = movedThisWeek(allTasks);

  const deadline = project.deadlineAt ? `${fmtDate(project.deadlineAt)} (dans ${daysFromNow(project.deadlineAt)} j)` : project.deadlineNote ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Avancement du projet</h1>
        <p className="mt-1 text-sm text-muted">{project.name} · espace client</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Avancement" value={`${project.progressPct} %`} />
        <Stat label="Échéance" value={deadline} />
        <Stat label="Dernière activité" value={fmtDate(project.lastActivityAt) ?? "—"} />
      </div>

      {moved.delivered.length + moved.testing.length + moved.started.length > 0 ? (
        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold text-text">Ce qui a bougé cette semaine</h2>
          <div className="mt-3 grid grid-cols-3 gap-4">
            <MovedColumn title="Livré" items={moved.delivered} color="text-mint" />
            <MovedColumn title="En test" items={moved.testing} color="text-blue" />
            <MovedColumn title="Démarré" items={moved.started} color="text-amber" />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {featureEpics.length === 0 ? (
          <p className="rounded-xl border border-border bg-panel px-5 py-6 text-sm text-muted">Le découpage détaillé n’est pas encore disponible.</p>
        ) : (
          featureEpics.map((epic) => (
            <div key={epic.id} className="rounded-xl border border-border bg-panel p-5">
              <h3 className="text-sm font-semibold text-text">{epic.title}</h3>
              <div className="mt-3 flex flex-col gap-2">
                {epic.tasks.map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-panel-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-text">{t.title}</p>
                      {t.description ? <p className="mt-0.5 text-xs text-muted">{t.description}</p> : null}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CLIENT_STATE_BADGE_CLASS[t.status]}`}>
                      {CLIENT_STATE_LABEL[t.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1.5 text-base font-semibold text-text">{value}</p>
    </div>
  );
}

function MovedColumn({ title, items, color }: { title: string; items: { id: string; title: string }[]; color: string }) {
  return (
    <div>
      <p className={`text-xs font-medium ${color}`}>{title} · {items.length}</p>
      <div className="mt-1.5 flex flex-col gap-1">
        {items.map((i) => <p key={i.id} className="text-sm text-text">{i.title}</p>)}
        {items.length === 0 ? <p className="text-sm text-muted">—</p> : null}
      </div>
    </div>
  );
}
