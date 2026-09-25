import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { fmtHours, fmtDate, STATUS_BADGE_CLASS, STATUS_LABEL, projectLabel, authorName, authorInitials } from "@/lib/format";
import {
  setTaskStatusAction,
  toggleTaskCriterionAction,
  addTaskCommentAction,
  addTaskCriterionAction,
  deleteTaskAction,
  deleteTaskCriterionAction,
  updateTaskAction,
  updateTaskCriterionAction,
  addTaskAttachmentAction,
  removeTaskAttachmentAction,
} from "../../../actions";
import { Attachments } from "../../../../attachments";
import type { TaskDetailResponse } from "../../../types";
import type { TaskStatus } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = {
  A_FAIRE: "Démarrer",
  EN_COURS: "Passer en revue",
  EN_REVUE: "Valider",
};

// Toutes les colonnes sont atteignables, y compris en arrière : arrêter une
// tâche ne doit pas obliger à la déclarer livrée. C'est aussi ce qui coupe le
// chronomètre, qui tourne tant que la tâche est « En cours ».
const STATUSES: TaskStatus[] = ["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"];

const NEXT: Record<string, TaskStatus | undefined> = {
  A_FAIRE: "EN_COURS",
  EN_COURS: "EN_REVUE",
  EN_REVUE: "TERMINE",
};

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; taskId: string }>;
  searchParams: Promise<{ info?: string; error?: string }>;
}) {
  await requireUser();
  const { id: projectId, taskId } = await params;
  const { info, error } = await searchParams;

  // Le backend vérifie que la tâche appartient bien à ce projet, et que le
  // rôle y a accès : dans les deux cas d'échec il renvoie `null`.
  const { task, epics = [], team = [] } = await apiGet<TaskDetailResponse>(
    `/api/admin/projects/task?projectId=${encodeURIComponent(projectId)}&taskId=${encodeURIComponent(taskId)}`,
  );
  if (!task) notFound();

  const advanceLabel = ACTION_LABEL[task.status];

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/projects/${projectId}`} className="text-sm text-muted hover:text-text">
        ← {projectLabel(task.epic.project.client.name, task.epic.project.name)}
      </Link>

      {info ? (
        <p className="rounded-lg border border-amber/30 bg-amber/5 px-4 py-2.5 text-sm text-text">
          {info}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red/30 bg-red/5 px-4 py-2.5 text-sm text-text">
          {error}
        </p>
      ) : null}

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

          {/* Les critères ne savaient que se cocher : la liste posée à la
              création était définitive, alors que c'est justement ce qu'on
              affine en cours de route. */}
          <div className="rounded-xl border border-border bg-panel p-5">
            <h2 className="text-sm font-semibold text-text">Critères d’acceptation</h2>
            <div className="mt-3 flex flex-col gap-1">
              {task.criteria.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-panel-2">
                  <form action={toggleTaskCriterionAction.bind(null, c.id, projectId, taskId)}>
                    <button
                      type="submit"
                      title={c.done ? "Décocher" : "Cocher"}
                      className={`px-1 text-sm ${c.done ? "text-mint" : "text-muted"}`}
                    >
                      {c.done ? "☑" : "☐"}
                    </button>
                  </form>
                  <form action={updateTaskCriterionAction} className="flex flex-1 items-center gap-2">
                    <input type="hidden" name="criterionId" value={c.id} />
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="taskId" value={taskId} />
                    <input
                      name="label"
                      defaultValue={c.label}
                      aria-label="Libellé du critère"
                      className={`flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-panel-2 ${c.done ? "text-muted line-through" : "text-text"}`}
                    />
                    <button type="submit" className="px-1 text-xs text-muted transition hover:text-mint">
                      Enregistrer
                    </button>
                  </form>
                  <form action={deleteTaskCriterionAction.bind(null, c.id, projectId, taskId)}>
                    <button type="submit" title="Supprimer" className="px-1 text-xs text-muted transition hover:text-red">
                      ✕
                    </button>
                  </form>
                </div>
              ))}
              {task.criteria.length === 0 ? (
                <p className="py-1 text-sm text-muted">Aucun critère pour l’instant.</p>
              ) : null}
            </div>
            <form action={addTaskCriterionAction} className="mt-3 flex gap-2 border-t border-border pt-3">
              <input type="hidden" name="taskId" value={taskId} />
              <input type="hidden" name="projectId" value={projectId} />
              <input name="label" required placeholder="Ajouter un critère…" className="input flex-1" />
              <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
                Ajouter
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-border bg-panel p-5">
            <h2 className="text-sm font-semibold text-text">Commentaires internes</h2>
            <div className="mt-3 flex flex-col gap-3">
              {task.comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint/15 text-xs font-medium text-mint">
                    {authorInitials(c.author)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted">
                      <span className="font-medium text-text">{authorName(c.author)}</span> · {fmtDate(c.createdAt)}
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

          <Attachments
            pieces={task.attachments}
            onAdd={addTaskAttachmentAction.bind(null, taskId, projectId)}
            onRemove={removeTaskAttachmentAction.bind(null, taskId, projectId)}
          />
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

          {/* L'API acceptait déjà ces corrections, aucun écran ne les appelait :
              un titre mal saisi ou une estimation à revoir restaient figés. */}
          <details className="rounded-xl border border-border bg-panel p-5">
            <summary className="cursor-pointer text-sm font-semibold text-text">Modifier la tâche</summary>
            <form action={updateTaskAction} className="mt-3 flex flex-col gap-2.5">
              <input type="hidden" name="taskId" value={taskId} />
              <input type="hidden" name="projectId" value={projectId} />
              <label className="flex flex-col gap-1 text-xs text-muted">
                Titre
                <input name="title" defaultValue={task.title} required className="input" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Description
                <textarea name="description" defaultValue={task.description} rows={3} className="input" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Lot
                <select name="epicId" defaultValue={task.epicId} className="input">
                  {epics.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Assigné
                <select name="assigneeId" defaultValue={task.assigneeId ?? ""} className="input">
                  <option value="">Non assigné</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Estimé (h)
                  <input name="estHours" defaultValue={String(task.estHours).replace(".", ",")} className="input" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Échéance
                  <input
                    name="dueAt"
                    type="date"
                    defaultValue={task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : ""}
                    className="input"
                  />
                </label>
              </div>
              <button type="submit" className="mt-1 rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">
                Enregistrer
              </button>
            </form>
            {/* Critères, commentaires et chronomètres tombent avec la tâche. */}
            <form action={deleteTaskAction.bind(null, taskId, projectId)} className="mt-3 border-t border-border pt-3">
              <button
                type="submit"
                className="w-full rounded-lg border border-red/40 px-3 py-2 text-xs font-medium text-red transition hover:bg-red/10"
              >
                Supprimer la tâche
              </button>
            </form>
          </details>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-panel p-5">
            {advanceLabel ? (
              <form action={setTaskStatusAction.bind(null, taskId, projectId, NEXT[task.status]!)}>
                <button type="submit" className="w-full rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-bg">
                  {advanceLabel}
                </button>
              </form>
            ) : null}

            <p className="mt-1 text-xs text-muted">Changer de statut</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.filter((s) => s !== task.status).map((s) => (
                <form key={s} action={setTaskStatusAction.bind(null, taskId, projectId, s)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition hover:border-mint/40 hover:text-text"
                  >
                    {STATUS_LABEL[s]}
                  </button>
                </form>
              ))}
            </div>
            <p className="text-xs text-muted">
              {task.status === "EN_COURS"
                ? "Le chronomètre tourne : le temps est compté pour l’assigné, dans ses horaires, et partagé avec ses autres tâches en cours."
                : "Passer la tâche à « En cours » démarre le chronomètre."}
            </p>
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
