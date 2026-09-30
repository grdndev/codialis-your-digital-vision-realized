import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createGoalAction } from "./actions";
import { GoalFields, GoalItem } from "./goal-parts";
import type { GoalRow, ObjectifsScreen } from "./types";

// Écran « Objectifs » (CC-356) — ouvert à toute l'équipe, piloté par la
// direction. En haut ce qui reste à atteindre ; en dessous l'historique des
// objectifs clos, mois par mois, avec le constat et sa raison : c'est ce qui
// permet de voir, d'un mois sur l'autre, ce qui coince.

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

// L'historique se range par mois d'ÉCHÉANCE : un objectif de septembre constaté
// début octobre reste un objectif de septembre.
function byMonth(goals: GoalRow[]): { label: string; goals: GoalRow[] }[] {
  const groups = new Map<string, GoalRow[]>();
  for (const g of [...goals].sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime())) {
    const key = g.dueAt.toISOString().slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  return [...groups.values()].map((list) => {
    const label = MONTH.format(list[0].dueAt);
    return { label: label.charAt(0).toUpperCase() + label.slice(1), goals: list };
  });
}

export default async function ObjectifsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireRole("DIR", "PM", "DEV");
  const canSteer = user.role === "DIR";
  const { error } = await searchParams;
  const { goals, projects } = await apiGet<ObjectifsScreen>("/api/admin/objectifs");

  const open = goals.filter((g) => !g.outcome);
  const closed = goals.filter((g) => g.outcome);
  const reached = closed.filter((g) => g.outcome === "ATTEINT").length;
  const rate = closed.length ? Math.round((reached / closed.length) * 100) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Objectifs</h1>
        <p className="mt-1 text-sm text-muted">
          {open.length} en cours · {closed.length} clos
          {rate !== null ? ` · ${reached} atteint${reached > 1 ? "s" : ""} sur ${closed.length} (${rate} %)` : ""}
          {canSteer ? "" : " · posés par la direction"}
        </p>
      </div>

      {error ? <p className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">{error}</p> : null}

      <div className="rounded-xl border border-border bg-panel">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-text">En cours</h2>
        </div>
        <div className="flex flex-col divide-y divide-border">
          {open.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">Aucun objectif en cours.</p>
          ) : (
            open.map((g) => <GoalItem key={g.id} goal={g} projects={projects} canSteer={canSteer} />)
          )}
        </div>
        {canSteer ? (
          <details className="border-t border-border px-5 py-3" open={goals.length === 0}>
            <summary className="cursor-pointer text-xs font-medium text-mint">+ Poser un objectif</summary>
            <GoalFields action={createGoalAction} projects={projects} submitLabel="Poser l’objectif" />
          </details>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-text">Historique</h2>
        {closed.length === 0 ? (
          <p className="rounded-xl border border-border bg-panel px-5 py-4 text-sm text-muted">
            Aucun objectif clos pour l’instant. Un objectif clos dit s’il a été atteint et, sinon,
            pourquoi.
          </p>
        ) : (
          byMonth(closed).map((month) => {
            const ok = month.goals.filter((g) => g.outcome === "ATTEINT").length;
            return (
              <div key={month.label} className="rounded-xl border border-border bg-panel">
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h3 className="text-sm font-medium text-text">{month.label}</h3>
                  <span className="text-xs text-muted">
                    {ok} atteint{ok > 1 ? "s" : ""} sur {month.goals.length}
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-border">
                  {month.goals.map((g) => (
                    <GoalItem key={g.id} goal={g} projects={projects} canSteer={canSteer} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
