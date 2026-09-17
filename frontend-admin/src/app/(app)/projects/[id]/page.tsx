import Link from "next/link";
import { redirect } from "next/navigation";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { fmtHours, fmtEUR, fmtDate, daysFromNow, GROUP_BADGE_CLASS, GROUP_LABEL, STATUS_BADGE_CLASS, STATUS_LABEL, TICKET_TYPE_BADGE_CLASS, TICKET_TYPE_LABEL, SEVERITY_LABEL, DEV_NATURE_LABEL, projectLabel } from "@/lib/format";
import {
  createEpicAction, createTaskAction, updateClientContactAction, updateProjectDescriptionAction,
  addClientQuestionAction, markQuestionAskedAction, answerClientQuestionAction,
  updateProjectAction, updateClientAction,
} from "../actions";
import type { ClientQuestionStatus, ProjectGroup, TaskStatus } from "@/lib/types";
import type { ClientRef } from "@/lib/dto";
import type {
  ApiCredentialRow, ClientQuestionRow, ProjectDetail, ProjectDetailResponse, ProjectTicketRow,
} from "../types";


export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { view } = await searchParams;
  const activeView = view === "kanban" ? "kanban" : view === "fiche" ? "fiche" : "list";

  // Les données de la fiche ne sont chargées que si son onglet est ouvert.
  const result = await apiGet<ProjectDetailResponse>(
    `/api/admin/projects/detail?id=${encodeURIComponent(id)}${activeView === "fiche" ? "&fiche=1" : ""}`,
  );

  // « Projets » dans le menu rouvre le dernier projet consulté : s'il a été
  // supprimé depuis, on renvoie à la liste plutôt que sur une page d'erreur
  // dont on ne sait pas sortir.
  if (result.access === "not-found") redirect("/projects?liste=1");
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

  const { project, team, apis, questions, tickets, clients } = result;
  // Un développeur consulte, il ne reconfigure pas le projet ni le client.
  const canEdit = user.role === "DIR" || user.role === "PM";

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
        {/* `liste=1` demande explicitement la liste : « Projets » dans le menu
            rouvre le dernier projet consulté, ce lien-ci fait le contraire. */}
        <Link href="/projects?liste=1" className="text-sm text-muted hover:text-text">
          ← Tous les projets
        </Link>
        <div className="mt-2 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-xl font-semibold text-text">
              {projectLabel(project.client.name, project.name)}
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
        {activeView !== "fiche" ? (
          <div className="flex items-center gap-2">
            <NewEpicDisclosure projectId={project.id} team={team} />
            {/* Depuis la fiche d'un projet, on ne pouvait ouvrir qu'un lot :
                signaler un bug obligeait à repasser par l'écran Tickets et à
                y resélectionner le projet. */}
            <Link
              href={`/tickets/new?project=${project.id}`}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted transition hover:text-text"
            >
              + Nouveau ticket
            </Link>
          </div>
        ) : null}
      </div>

      {activeView === "list" ? (
        <ListView epics={workEpics} projectId={project.id} team={team} tickets={tickets} />
      ) : activeView === "kanban" ? (
        <KanbanView tasks={allTasks} projectId={project.id} tickets={tickets} />
      ) : (
        <FicheView project={project} deadline={deadline} apis={apis} questions={questions} clients={clients} canEdit={canEdit} />
      )}
    </div>
  );
}

function FicheView({
  project,
  deadline,
  apis,
  questions,
  clients,
  canEdit,
}: {
  project: ProjectDetail;
  deadline: string;
  apis: ApiCredentialRow[];
  questions: ClientQuestionRow[];
  clients: ClientRef[];
  canEdit: boolean;
}) {
  const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="flex flex-col gap-6">
        {canEdit ? (
          <div className="rounded-xl border border-border bg-panel p-5">
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-text">
                Modifier le projet
              </summary>
              <form action={updateProjectAction} className="mt-4 flex flex-col gap-3">
                <input type="hidden" name="projectId" value={project.id} />
                <div className="grid grid-cols-2 gap-3">
                  <PField label="Nom">
                    <input name="name" required defaultValue={project.name} className="input" />
                  </PField>
                  <PField label="Client">
                    <select name="clientId" defaultValue={project.client.id} className="input">
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </PField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PField label="Phase">
                    <select name="group" defaultValue={project.group} className="input">
                      {(["DEV", "FIN", "WAR", "MAI", "CLO"] as ProjectGroup[]).map((g) => (
                        <option key={g} value={g}>{GROUP_LABEL[g]}</option>
                      ))}
                    </select>
                  </PField>
                  <PField label="Libellé de phase" hint="facultatif">
                    <input name="phaseLabel" defaultValue={project.phaseLabel} className="input" />
                  </PField>
                </div>
                <PField label="Description">
                  <textarea name="description" rows={2} defaultValue={project.description} className="input" />
                </PField>
                <div className="grid grid-cols-3 gap-3">
                  <PField label="Heures vendues">
                    <input name="hoursSold" defaultValue={project.hoursSold} className="input" />
                  </PField>
                  <PField label="Montant vendu (€)">
                    <input name="soldAmount" defaultValue={project.soldAmount ?? ""} className="input" />
                  </PField>
                  <PField label="Coût (€)">
                    <input name="costAmount" defaultValue={project.costAmount ?? ""} className="input" />
                  </PField>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <PField label="Ouvert le">
                    <input name="openedAt" type="date" defaultValue={day(project.openedAt)} className="input" />
                  </PField>
                  <PField label="Échéance">
                    <input name="deadlineAt" type="date" defaultValue={day(project.deadlineAt)} className="input" />
                  </PField>
                  <PField label="Note d’échéance" hint="si pas de date">
                    <input name="deadlineNote" defaultValue={project.deadlineNote ?? ""} className="input" />
                  </PField>
                </div>
                <p className="text-xs text-muted">
                  L’avancement et les heures passées ne se saisissent pas : ils suivent les tâches et
                  les saisies de temps. Passer la phase en « Clôturé » horodate la clôture.
                </p>
                <button type="submit" className="self-start rounded-lg bg-mint px-4 py-2 text-xs font-semibold text-bg">
                  Enregistrer
                </button>
              </form>
            </details>
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold text-text">Client</h2>
          {canEdit ? (
            <form action={updateClientAction} className="mt-2 flex gap-2">
              <input type="hidden" name="clientId" value={project.client.id} />
              <input name="name" defaultValue={project.client.name} className="input flex-1" />
              <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-text">
                Renommer
              </button>
            </form>
          ) : (
            <p className="mt-2 text-base font-medium text-text">{project.client.name}</p>
          )}
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

function PField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">
        {label}
        {hint ? <span className="ml-1 text-[10px] text-muted/70">({hint})</span> : null}
      </label>
      {children}
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
  tickets,
}: {
  epics: EpicWithTasks[];
  projectId: string;
  team: { id: string; name: string }[];
  tickets: ProjectTicketRow[];
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

      {/* Les tickets ne sont rattachés qu'au projet, pas forcément à un lot :
          ils forment donc leur propre bloc plutôt que de se glisser dans un
          épic auquel la plupart n'appartiennent pas. */}
      <div className="rounded-xl border border-border bg-panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-text">Tickets du projet</h2>
          <span className="text-xs text-muted">
            {tickets.filter((t) => t.status !== "TERMINE").length} ouvert
            {tickets.filter((t) => t.status !== "TERMINE").length > 1 ? "s" : ""} sur {tickets.length}
          </span>
        </div>
        {tickets.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Aucun ticket sur ce projet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <tbody className="divide-y divide-border">
              {tickets.map((t) => (
                <tr key={t.id} className="transition hover:bg-panel-2">
                  <td className="whitespace-nowrap px-5 py-2">
                    <Link href={`/tickets/${t.ref}`} className="font-medium text-text hover:text-mint">
                      {t.ref}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_TYPE_BADGE_CLASS[t.type]}`}>
                      {TICKET_TYPE_LABEL[t.type]}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <Link href={`/tickets/${t.ref}`} className="text-text hover:text-mint">
                      {t.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-xs text-muted">
                    {t.severity ? SEVERITY_LABEL[t.severity] : t.devNature ? DEV_NATURE_LABEL[t.devNature] : "—"}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-muted">{t.assignee?.name ?? "Non assigné"}</td>
                  <td className="whitespace-nowrap py-2 pr-5 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
  tickets,
}: {
  tasks: { id: string; title: string; status: TaskStatus; estHours: number; assignee: { name: string } | null; epicTitle: string }[];
  projectId: string;
  tickets: ProjectTicketRow[];
}) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.status);
        // Tâches et tickets partagent les mêmes états : ils tombent dans les
        // mêmes colonnes. La pastille de type distingue les seconds.
        const ticketItems = tickets.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="rounded-xl border border-border bg-panel">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-medium text-text">{col.label}</span>
              <span className="text-xs text-muted">{items.length + ticketItems.length}</span>
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
              {ticketItems.map((t) => (
                <Link
                  key={t.id}
                  href={`/tickets/${t.ref}`}
                  className="rounded-lg border border-border bg-panel-2 p-3 text-sm transition hover:border-mint/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted">{t.ref}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TICKET_TYPE_BADGE_CLASS[t.type]}`}>
                      {TICKET_TYPE_LABEL[t.type]}
                    </span>
                  </div>
                  <p className="mt-1 text-text">{t.title}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span>{t.assignee?.name ?? "Non assigné"}</span>
                    <span>{fmtHours(t.estHours)}</span>
                  </div>
                </Link>
              ))}
              {items.length + ticketItems.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted">—</p>
              ) : null}
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
