import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { fmtHours, fmtDate, STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/format";
import { updateTaskStatusAction, toggleTaskCriterionAction, addTaskCommentAction } from "../../../actions";
import type { TaskDetailResponse } from "../../../types";

const ACTION_LABEL: Record<string, string> = {
  A_FAIRE: "Démarrer",
  EN_COURS: "Passer en revue",
  EN_REVUE: "Valider",
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  await requireUser();
  const { id: projectId, taskId } = await params;

  // Le backend vérifie que la tâche appartient bien à ce projet, et que le
  // rôle y a accès : dans les deux cas d'échec il renvoie `null`.
  const { task } = await apiGet<TaskDetailResponse>(
    `/api/admin/projects/task?projectId=${encodeURIComponent(projectId)}&taskId=${encodeURIComponent(taskId)}`,
  );
  if (!task) notFound();

  const advanceLabel = ACTION_LABEL[task.status];

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/projects/${projectId}`} className="text-sm text-muted hover:text-text">
        ← {task.epic.project.client.name} — {task.epic.project.name}
      </Link>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-muted">{task.epic.title}</p>
                <h1 className="mt-1 text-lg font-semibold text-text">{task.title}</h1>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[task.status]}`}>
                {STATUS_LABEL[task.status]}
              </span>
            </div>
            <p className="mt-4 text-sm text-muted">{task.description || "Aucune description."}</p>
          </div>

          {task.criteria.length > 0 ? (
            <div className="rounded-xl border border-border bg-panel p-5">
              <h2 className="text-sm font-semibold text-text">Critères d’acceptation</h2>
              <div className="mt-3 flex flex-col gap-2">
                {task.criteria.map((c) => (
                  <form key={c.id} action={toggleTaskCriterionAction.bind(null, c.id, projectId, taskId)}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-panel-2"
                    >
                      <span className={c.done ? "text-mint" : "text-muted"}>{c.done ? "☑" : "☐"}</span>
                      <span className={c.done ? "text-muted line-through" : "text-text"}>{c.label}</span>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-panel p-5">
            <h2 className="text-sm font-semibold text-text">Commentaires internes</h2>
            <div className="mt-3 flex flex-col gap-3">
              {task.comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint/15 text-xs font-medium text-mint">
                    {c.author.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted">
                      <span className="font-medium text-text">{c.author.name}</span> · {fmtDate(c.createdAt)}
                    </p>
                    <p className="mt-0.5 text-sm text-text">{c.body}</p>
                  </div>
                </div>
              ))}
              {task.comments.length === 0 ? <p className="text-sm text-muted">Aucun commentaire pour l’instant.</p> : null}
            </div>
            <form action={addTaskCommentAction} className="mt-4 flex gap-2">
              <input type="hidden" name="taskId" value={taskId} />
              <input type="hidden" name="projectId" value={projectId} />
              <input
                name="body"
                required
                placeholder="Ajouter un commentaire…"
                className="flex-1 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text"
              />
              <button type="submit" className="rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">
                Envoyer
              </button>
            </form>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-panel p-5">
            <h2 className="text-sm font-semibold text-text">Détails</h2>
            <dl className="mt-3 flex flex-col gap-2.5 text-sm">
              <Row label="Assigné" value={task.assignee?.name ?? "Non assigné"} />
              <Row label="Échéance" value={fmtDate(task.dueAt) ?? "—"} />
              <Row label="Estimé" value={fmtHours(task.estHours)} />
              <Row label="Passé" value={fmtHours(task.spentHours)} />
            </dl>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-panel p-5">
            {advanceLabel ? (
              <form action={updateTaskStatusAction.bind(null, taskId, projectId, "advance")}>
                <button type="submit" className="w-full rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-bg">
                  {advanceLabel}
                </button>
              </form>
            ) : (
              <form action={updateTaskStatusAction.bind(null, taskId, projectId, "reopen")}>
                <button type="submit" className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-text">
                  Rouvrir
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}
