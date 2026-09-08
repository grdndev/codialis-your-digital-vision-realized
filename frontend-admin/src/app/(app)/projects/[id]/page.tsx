import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { fmtHours, fmtEUR, fmtDate, daysFromNow, GROUP_BADGE_CLASS, GROUP_LABEL, STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/format";
import {
  createEpicAction, createTaskAction, updateClientContactAction, updateProjectDescriptionAction,
  addClientQuestionAction, markQuestionAskedAction, answerClientQuestionAction,
} from "../actions";
import type { ClientQuestionStatus, TaskStatus } from "@/lib/types";
import type {
  ApiCredentialRow, ClientQuestionRow, ProjectDetail, ProjectDetailResponse,
} from "../types";


export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { view } = await searchParams;
  const activeView = view === "kanban" ? "kanban" : view === "fiche" ? "fiche" : "list";

  // Les données de la fiche ne sont chargées que si son onglet est ouvert.
  const result = await apiGet<ProjectDetailResponse>(
    `/api/admin/projects/detail?id=${encodeURIComponent(id)}${activeView === "fiche" ? "&fiche=1" : ""}`,
  );

  if (result.access === "not-found") notFound();
  // Un développeur non assigné voit un refus explicite, pas un 404 : le
  // projet existe, il n’y a simplement pas accès.
  if (result.access === "not-assigned") {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/tickets" className="text-sm text-muted hover:text-text">
          ← Retour
        </Link>
        <p className="text-sm text-muted">Vous n’êtes pas assigné à ce projet.</p>
      </div>
    );
  }

  const { project, team, apis, questions } = result;

  const workEpics = project.epics.filter((e) => e.tasks.length > 0 || e.estHours > 0);
  const allTasks = project.epics.flatMap((e) => e.tasks.map((t) => ({ ...t, epicTitle: e.title })));

  const deadline = project.group === "CLO"
    ? project.closedAt ? `clôturé ${fmtDate(project.closedAt)}` : "—"
    : project.deadlineAt
      ? `${fmtDate(project.deadlineAt)} (${daysFromNow(project.deadlineAt)} j)`
      : project.deadlineNote ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/projects" className="text-sm text-muted hover:text-text">
          ← Tous les projets
        </Link>
        <div className="mt-2 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-xl font-semibold text-text">
              {project.client.name} — {project.name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">{project.description}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${GROUP_BADGE_CLASS[project.group]}`}>
            {project.phaseLabel || GROUP_LABEL[project.group]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Avancement" value={`${project.progressPct} %`} />
        <Stat label="Heures" value={`${fmtHours(project.hoursSpent)} / ${fmtHours(project.hoursSold)}`} />
        <Stat label="Échéance" value={deadline} />
        <Stat label="Dernière activité" value={fmtDate(project.lastActivityAt) ?? "—"} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-border bg-panel p-1 text-sm">
          <Link
            href={`/projects/${project.id}?view=list`}
            className={`rounded-md px-3 py-1.5 ${activeView === "list" ? "bg-mint/10 text-mint" : "text-muted"}`}
          >
            Liste
          </Link>
          <Link
            href={`/projects/${project.id}?view=kanban`}
            className={`rounded-md px-3 py-1.5 ${activeView === "kanban" ? "bg-mint/10 text-mint" : "text-muted"}`}
          >
            Kanban
          </Link>
          <Link
            href={`/projects/${project.id}?view=fiche`}
            className={`rounded-md px-3 py-1.5 ${activeView === "fiche" ? "bg-mint/10 text-mint" : "text-muted"}`}
          >
            Fiche
          </Link>
        </div>
        {activeView !== "fiche" ? <NewEpicDisclosure projectId={project.id} team={team} /> : null}
      </div>

      {activeView === "list" ? (
        <ListView epics={workEpics} projectId={project.id} team={team} />
      ) : activeView === "kanban" ? (
        <KanbanView tasks={allTasks} projectId={project.id} />
      ) : (
        <FicheView project={project} deadline={deadline} apis={apis} questions={questions} />
      )}
    </div>
  );
}

function FicheView({
  project,
  deadline,
  apis,
  questions,
}: {
  project: ProjectDetail;
  deadline: string;
  apis: ApiCredentialRow[];
  questions: ClientQuestionRow[];
}) {

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold text-text">Client</h2>
          <p className="mt-2 text-base font-medium text-text">{project.client.name}</p>
          <form action={updateClientContactAction} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="clientId" value={project.client.id} />
            <input type="hidden" name="projectId" value={project.id} />
            <label className="flex flex-col gap-1 text-xs text-muted">
              Contact
              <input name="contactName" defaultValue={project.client.contactName ?? ""} placeholder="Nom du contact" className="input" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              E-mail
              <input name="contactEmail" type="email" defaultValue={project.client.contactEmail ?? ""} placeholder="contact@client.fr" className="input" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Téléphone
              <input name="contactPhone" defaultValue={project.client.contactPhone ?? ""} placeholder="06 00 00 00 00" className="input" />
            </label>
            <button type="submit" className="mt-1 self-start rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text">
              Enregistrer
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold text-text">Contexte du projet</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Field label="Phase">{project.phaseLabel || GROUP_LABEL[project.group]}</Field>
            <Field label="Ouvert le">{fmtDate(project.openedAt) ?? "—"}</Field>
            <Field label="Échéance">{deadline}</Field>
            <Field label="Vendu">{project.soldAmount != null ? fmtEUR(project.soldAmount) : "—"}</Field>
          </div>
          <form action={updateProjectDescriptionAction} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="projectId" value={project.id} />
            <label className="flex flex-col gap-1 text-xs text-muted">
              Description
              <textarea name="description" defaultValue={project.description} rows={4} className="input" />
            </label>
            <button type="submit" className="self-start rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text">
              Enregistrer
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Accès techniques</h2>
            <Link href={`/resources?project=${project.id}`} className="text-xs font-medium text-mint">
              Gérer dans Ressources →
            </Link>
          </div>
          <div className="mt-3 flex flex-col divide-y divide-border">
            {apis.length === 0 ? (
              <p className="py-2 text-sm text-muted">Aucune API renseignée.</p>
            ) : (
              apis.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="text-text">{a.name}</p>
                    <p className="text-xs text-muted">{a.role} · {a.env}</p>
                  </div>
                  <span className="text-xs text-muted">{a.expiryNote || "—"}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Questions posées au client</h2>
        <div className="mt-3 flex flex-col divide-y divide-border">
          {questions.length === 0 ? (
            <p className="py-2 text-sm text-muted">Aucune question suivie pour ce projet.</p>
          ) : (
            questions.map((q) => <ClientQuestionRow key={q.id} question={q} projectId={project.id} />)
          )}
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-mint">+ Poser une question</summary>
          <form action={addClientQuestionAction} className="mt-2 flex gap-2">
            <input type="hidden" name="projectId" value={project.id} />
            <input name="question" required placeholder="Ex : quelle est la deadline souhaitée ?" className="input flex-1" />
            <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Ajouter</button>
          </form>
        </details>
      </div>
    </div>
  );
}

const QUESTION_STATUS_LABEL: Record<ClientQuestionStatus, string> = {
  A_DEMANDER: "À demander",
  DEMANDE: "Demandé",
  REPONDU: "Répondu",
};
const QUESTION_STATUS_CLASS: Record<ClientQuestionStatus, string> = {
  A_DEMANDER: "bg-white/5 text-muted",
  DEMANDE: "bg-amber/10 text-amber",
  REPONDU: "bg-mint/10 text-mint",
};

function ClientQuestionRow({
  question: q,
  projectId,
}: {
  question: { id: string; question: string; status: ClientQuestionStatus; answer: string; askedAt: Date | null; answeredAt: Date | null };
  projectId: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-text">{q.question}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${QUESTION_STATUS_CLASS[q.status]}`}>
          {QUESTION_STATUS_LABEL[q.status]}
        </span>
      </div>
      {q.status === "REPONDU" ? (
        <p className="text-xs text-muted">
          {q.answer} {q.answeredAt ? `· répondu le ${fmtDate(q.answeredAt)}` : ""}
        </p>
      ) : q.status === "DEMANDE" ? (
        <p className="text-xs text-muted">demandé le {q.askedAt ? fmtDate(q.askedAt) : "—"}</p>
      ) : null}
      {q.status === "A_DEMANDER" ? (
        <form action={markQuestionAskedAction.bind(null, q.id, projectId)}>
          <button type="submit" className="text-xs font-medium text-mint">Marquer comme demandé</button>
        </form>
      ) : q.status === "DEMANDE" ? (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-mint">Enregistrer la réponse</summary>
          <form action={answerClientQuestionAction} className="mt-1.5 flex gap-2">
            <input type="hidden" name="questionId" value={q.id} />
            <input type="hidden" name="projectId" value={projectId} />
            <input name="answer" required placeholder="Réponse du client…" className="input flex-1" />
            <button type="submit" className="rounded-lg bg-mint px-2.5 py-1 text-xs font-semibold text-bg">Valider</button>
          </form>
        </details>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-text">{children}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-base font-semibold text-text">{value}</p>
    </div>
  );
}

type EpicWithTasks = {
  id: string;
  title: string;
  estHours: number;
  lead: { name: string } | null;
  tasks: { id: string; title: string; status: TaskStatus; estHours: number; spentHours: number; assignee: { name: string } | null }[];
};

function ListView({
  epics,
  projectId,
  team,
}: {
  epics: EpicWithTasks[];
  projectId: string;
  team: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {epics.length === 0 ? (
        <p className="rounded-xl border border-border bg-panel px-5 py-6 text-sm text-muted">
          Aucun découpage en épics pour ce projet pour l’instant.
        </p>
      ) : (
        epics.map((epic) => {
          const spent = epic.tasks.reduce((s, t) => s + t.spentHours, 0);
          const est = epic.estHours || epic.tasks.reduce((s, t) => s + t.estHours, 0);
          const done = epic.tasks.filter((t) => t.status === "TERMINE").length;
          const pct = epic.tasks.length ? Math.round((done / epic.tasks.length) * 100) : 0;
          return (
            <details key={epic.id} className="group rounded-xl border border-border bg-panel open:pb-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-muted transition group-open:rotate-90">▶</span>
                  <span className="truncate text-sm font-medium text-text">{epic.title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-6 text-xs text-muted">
                  <span>{epic.lead?.name ?? "Non assigné"}</span>
                  <span>{epic.tasks.length} tâches</span>
                  <span>
                    {fmtHours(spent)} / {fmtHours(est)}
                  </span>
                  <div className="flex w-24 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-mint" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right">{pct}%</span>
                  </div>
                </div>
              </summary>
              <div className="border-t border-border px-5 py-3">
                <table className="w-full border-collapse text-sm">
                  <tbody className="divide-y divide-border">
                    {epic.tasks.map((task) => (
                      <tr key={task.id} className="transition hover:bg-panel-2">
                        <td className="py-2 pr-4">
                          <Link href={`/projects/${projectId}/tasks/${task.id}`} className="text-text hover:text-mint">
                            {task.title}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap py-2 pr-4">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[task.status]}`}>
                            {STATUS_LABEL[task.status]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-2 pr-4 text-muted">{task.assignee?.name ?? "Non assigné"}</td>
                        <td className="whitespace-nowrap py-2 text-right text-muted">
                          {fmtHours(task.spentHours)} / {fmtHours(task.estHours)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <NewTaskDisclosure projectId={projectId} epicId={epic.id} team={team} />
              </div>
            </details>
          );
        })
      )}
    </div>
  );
}

const KANBAN_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "A_FAIRE", label: "À faire" },
  { status: "EN_COURS", label: "En cours" },
  { status: "EN_REVUE", label: "En revue" },
  { status: "TERMINE", label: "Terminé" },
];

function KanbanView({
  tasks,
  projectId,
}: {
  tasks: { id: string; title: string; status: TaskStatus; estHours: number; assignee: { name: string } | null; epicTitle: string }[];
  projectId: string;
}) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="rounded-xl border border-border bg-panel">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-medium text-text">{col.label}</span>
              <span className="text-xs text-muted">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2 p-3">
              {items.map((t) => (
                <Link
                  key={t.id}
                  href={`/projects/${projectId}/tasks/${t.id}`}
                  className="rounded-lg border border-border bg-panel-2 p-3 text-sm transition hover:border-mint/40"
                >
                  <p className="text-text">{t.title}</p>
                  <p className="mt-1 text-xs text-muted">{t.epicTitle}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span>{t.assignee?.name ?? "Non assigné"}</span>
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
  );
}

function NewEpicDisclosure({ projectId, team }: { projectId: string; team: { id: string; name: string }[] }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">
        + Nouvel épic
      </summary>
      <form
        action={createEpicAction}
        className="absolute right-0 z-10 mt-2 flex w-72 flex-col gap-2 rounded-xl border border-border bg-panel p-4 shadow-2xl"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <label className="text-xs text-muted">
          Nom
          <input name="title" required className="mt-1 w-full rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-text" />
        </label>
        <label className="text-xs text-muted">
          Budget d’heures
          <input name="estHours" type="text" placeholder="20" className="mt-1 w-full rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-text" />
        </label>
        <label className="text-xs text-muted">
          Responsable
          <select name="leadId" className="mt-1 w-full rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-text">
            <option value="">Non assigné</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Échéance
          <input name="dueAt" type="date" className="mt-1 w-full rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-text" />
        </label>
        <button type="submit" className="mt-1 rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
          Créer l’épic
        </button>
      </form>
    </details>
  );
}

function NewTaskDisclosure({
  projectId,
  epicId,
  team,
}: {
  projectId: string;
  epicId: string;
  team: { id: string; name: string }[];
}) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer list-none text-xs font-medium text-mint">+ Tâche dans cet épic</summary>
      <form action={createTaskAction} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="epicId" value={epicId} />
        <label className="text-xs text-muted">
          Titre
          <input name="title" required className="mt-1 block w-48 rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-text" />
        </label>
        <label className="text-xs text-muted">
          Estimé (h)
          <input name="estHours" type="text" placeholder="4" className="mt-1 block w-20 rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-text" />
        </label>
        <label className="text-xs text-muted">
          Assigné
          <select name="assigneeId" className="mt-1 block w-36 rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-text">
            <option value="">Non assigné</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
          Ajouter
        </button>
      </form>
    </details>
  );
}
