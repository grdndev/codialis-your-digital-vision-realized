import Link from "next/link";
import { daysFromNow, fmtDate, fmtHours, projectLabel } from "@/lib/format";
import { closeGoalAction, deleteGoalAction, reopenGoalAction, updateGoalAction } from "./actions";
import type { GoalProject, GoalRow } from "./types";

// Un objectif tel que le montrent le Dashboard et l'écran Objectifs : son
// échéance, le projet suivi et son avancement, et — une fois clos — le constat
// et sa raison. Les gestes de pilotage n'apparaissent qu'à la direction.

export function GoalItem({ goal: g, projects, canSteer }: { goal: GoalRow; projects: GoalProject[]; canSteer: boolean }) {
  const days = daysFromNow(g.dueAt);
  const due = g.outcome
    ? { text: `échéance ${fmtDate(g.dueAt)}`, color: "text-muted" }
    : days < 0
      ? { text: `échéance dépassée · ${fmtDate(g.dueAt)}`, color: "text-red" }
      : { text: `pour le ${fmtDate(g.dueAt)} · ${days === 0 ? "aujourd’hui" : `dans ${days} j`}`, color: days <= 5 ? "text-amber" : "text-muted" };
  return (
    <div className="flex flex-col gap-2 px-5 py-3 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={g.outcome ? "text-text" : "font-medium text-text"}>{g.title}</p>
          {g.detail ? <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted">{g.detail}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`text-xs font-medium ${due.color}`}>{due.text}</span>
          <OutcomeBadge goal={g} />
          {canSteer && g.outcome ? (
            <form action={reopenGoalAction.bind(null, g.id)}>
              <button type="submit" className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-muted hover:text-text">
                Rouvrir
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {g.outcome && g.outcomeNote ? (
        <p className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-xs ${g.outcome === "ATTEINT" ? "bg-mint/5 text-text" : "bg-red/5 text-text"}`}>
          <span className="font-medium">{g.outcome === "ATTEINT" ? "Comment : " : "Pourquoi : "}</span>
          {g.outcomeNote}
        </p>
      ) : null}

      {g.project ? (
        <Link href={`/projects/${g.project.id}`} className="flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-2 text-xs transition hover:bg-panel">
          <span className="min-w-0 flex-1 truncate text-text">{projectLabel(g.project.client.name, g.project.name)}</span>
          <div className="flex w-40 shrink-0 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-mint" style={{ width: `${Math.min(100, g.project.progressPct)}%` }} />
            </div>
            <span className="w-9 text-right text-muted">{g.project.progressPct}%</span>
          </div>
          <span className="w-28 shrink-0 text-right text-muted">
            {fmtHours(g.project.hoursSpent)} / {fmtHours(g.project.hoursSold)}
          </span>
        </Link>
      ) : null}

      {canSteer && !g.outcome ? <CloseGoal goalId={g.id} /> : null}

      {canSteer ? (
        <details>
          <summary className="cursor-pointer text-xs text-muted hover:text-text">Modifier</summary>
          <GoalFields action={updateGoalAction.bind(null, g.id)} projects={projects} goal={g} submitLabel="Enregistrer" />
          <form action={deleteGoalAction.bind(null, g.id)} className="mt-2">
            <button type="submit" className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-red/50 hover:text-red">
              Supprimer l’objectif
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}

function OutcomeBadge({ goal: g }: { goal: GoalRow }) {
  if (!g.outcome) return null;
  const reached = g.outcome === "ATTEINT";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${reached ? "bg-mint/10 text-mint" : "bg-red/10 text-red"}`}>
      {reached ? "Atteint" : "Non atteint"}
      {g.closedAt ? ` · ${fmtDate(g.closedAt)}` : ""}
    </span>
  );
}

// Le constat, en deux formulaires : « atteint » d'un clic (le commentaire est
// facultatif), « non atteint » avec sa raison, obligatoire — sans elle,
// l'historique ne dirait rien de ce qu'il faut changer.
function CloseGoal({ goalId }: { goalId: string }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <details className="flex-1">
        <summary className="inline-block cursor-pointer rounded-full bg-mint/10 px-3 py-1 text-xs font-medium text-mint">Atteint</summary>
        <form action={closeGoalAction.bind(null, goalId, "ATTEINT")} className="mt-2 flex items-end gap-2">
          <textarea name="note" rows={2} placeholder="Comment (facultatif)" className="input flex-1 text-xs" />
          <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Valider</button>
        </form>
      </details>
      <details className="flex-1">
        <summary className="inline-block cursor-pointer rounded-full bg-red/10 px-3 py-1 text-xs font-medium text-red">Non atteint</summary>
        <form action={closeGoalAction.bind(null, goalId, "NON_ATTEINT")} className="mt-2 flex items-end gap-2">
          <textarea name="note" rows={2} required placeholder="Pourquoi ? (obligatoire)" className="input flex-1 text-xs" />
          <button type="submit" className="rounded-lg bg-red/90 px-3 py-1.5 text-xs font-semibold text-bg">Valider</button>
        </form>
      </details>
    </div>
  );
}

export function GoalFields({
  action,
  projects,
  goal,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  projects: GoalProject[];
  goal?: GoalRow;
  submitLabel: string;
}) {
  return (
    <form action={action} className="mt-2 grid grid-cols-4 gap-2">
      <input name="title" required defaultValue={goal?.title ?? ""} placeholder="Objectif (ex : livrer la V1 de Top formation)" className="input col-span-2" />
      <input
        name="dueAt"
        type="date"
        required
        defaultValue={goal ? new Date(goal.dueAt).toISOString().slice(0, 10) : ""}
        className="input"
        aria-label="Échéance"
      />
      <select name="projectId" defaultValue={goal?.projectId ?? ""} className="input" aria-label="Projet suivi">
        <option value="">Aucun projet</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {projectLabel(p.client.name, p.name)}
          </option>
        ))}
      </select>
      <textarea name="detail" rows={2} defaultValue={goal?.detail ?? ""} placeholder="Précisions (facultatif)" className="input col-span-3" />
      <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
        {submitLabel}
      </button>
    </form>
  );
}
