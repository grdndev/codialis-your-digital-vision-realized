import Link from "next/link";
import { redirect } from "next/navigation";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ticketHref } from "@/lib/ticket-return";
import { fmtHours, fmtEUR, fmtDate, daysFromNow, GROUP_BADGE_CLASS, GROUP_LABEL, STATUS_BADGE_CLASS, STATUS_LABEL, TICKET_TYPE_BADGE_CLASS, TICKET_TYPE_LABEL, SEVERITY_LABEL, DEV_NATURE_LABEL, projectLabel, coverageStatus } from "@/lib/format";
import {
  createEpicAction, createEpicTicketAction, deleteEpicAction, importProjectJsonAction, updateClientContactAction,
  updateEpicAction, updateProjectDescriptionAction,
  addClientQuestionAction, markQuestionAskedAction, answerClientQuestionAction,
  updateProjectAction, updateClientAction, updateProjectPhaseAction, updateProjectCoverageAction,
} from "../actions";
import { bulkUpdateTicketsAction } from "../../tickets/actions";
import { BulkSelection, SelectAll } from "../../bulk-selection";
import type { ClientQuestionStatus, ProjectGroup, TaskStatus } from "@/lib/types";
import type { ClientRef } from "@/lib/dto";
import type {
  ApiCredentialRow, ClientQuestionRow, ProjectDetail, ProjectDetailResponse, ProjectEpic, ProjectTicketRow,
} from "../types";
import {
  FilterGroup, FilterLink, Pagination, listParam, paginate, parsePaging, toggleValue,
} from "../../list-controls";
import { TicketExportPanel } from "../../tickets/export-panel";
import { Popover } from "../../popover";

const TICKET_STATUSES: TaskStatus[] = ["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"];
// Valeur d'adresse du filtre « Non assigné » : un identifiant de compte ne
// peut pas la prendre.
const UNASSIGNED = "none";

type ProjectQuery = { view?: string; info?: string; status?: string; assignee?: string; page?: string; per?: string };
type ProjectQueryKey = Exclude<keyof ProjectQuery, "info">;

// Les tickets d'un projet se filtrent par statut et par assigné, chaque critère
// acceptant plusieurs valeurs ; les deux se croisent. Un projet en porte
// facilement une centaine, et les retrouver à l'œil devenait impossible
// (CC-346, CC-353).
function filterProjectTickets(tickets: ProjectTicketRow[], status: string[], assignee: string[]) {
  return tickets.filter(
    (t) =>
      (!status.length || status.includes(t.status)) &&
      (!assignee.length || assignee.includes(t.assigneeId ?? UNASSIGNED)),
  );
}

// Les assignés proposés au filtre sont ceux qui portent au moins un ticket du
// projet : offrir le nom de quelqu'un qui n'y a rien ne mènerait qu'à une liste
// vide.
function ticketAssignees(tickets: ProjectTicketRow[]) {
  const byId = new Map<string, string>();
  for (const t of tickets) if (t.assignee) byId.set(t.assignee.id, t.assignee.name);
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}


export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<ProjectQuery>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const { view, info } = sp;
  const activeView = view === "kanban" ? "kanban" : view === "fiche" ? "fiche" : "list";

  // Les données de la fiche ne sont chargées que si son onglet est ouvert.
  const result = await apiGet<ProjectDetailResponse>(
    `/api/admin/projects/detail?id=${encodeURIComponent(id)}${activeView === "fiche" ? "&fiche=1" : ""}`,
  );

  // « Projets » dans le menu rouvre le dernier projet consulté : s'il a été
  // supprimé depuis, on renvoie à la liste plutôt que sur une page d'erreur
  // dont on ne sait pas sortir.
  if (result.access === "not-found") redirect("/projects?liste=1");
  // Un projet hors périmètre se dit, il ne disparaît pas en silence : le lien
  // vient forcément de quelque part, et « rien ne s'est passé » n'explique rien.
  if (result.access === "forbidden") {
    redirect(
      `/projects?liste=1&error=${encodeURIComponent(
        "Ce projet ne vous est pas ouvert : aucun ticket ne vous y est assigné.",
      )}`,
    );
  }
  const { project, team, apis, questions, tickets, clients } = result;
  // Un développeur consulte, il ne reconfigure pas le projet ni le client.
  const canEdit = user.role === "DIR" || user.role === "PM";

  const statusFilter = listParam(sp.status);
  const assigneeFilter = listParam(sp.assignee);
  const shownTickets = filterProjectTickets(tickets, statusFilter, assigneeFilter);
  // La pagination ne porte que sur les tickets hors épic : ceux d'un épic
  // s'affichent tous sous leur épic.
  const { page, perPage } = parsePaging(sp.page, sp.per);

  // Toute adresse de l'écran reconduit la vue, les filtres et la page en
  // cours ; `next` ne dit que ce qui change. Toucher un filtre ramène en
  // première page, sans quoi on tomberait sur une page vide.
  function projectHref(next: Partial<Record<ProjectQueryKey, string | null>>) {
    const merged: Partial<Record<ProjectQueryKey, string | null>> = {
      view: activeView === "list" ? null : activeView,
      status: sp.status ?? null,
      assignee: sp.assignee ?? null,
      page: sp.page ?? null,
      per: sp.per ?? null,
      ...next,
    };
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) if (value) query.set(key, value);
    const qs = query.toString();
    return `/projects/${project.id}${qs ? `?${qs}` : ""}`;
  }
  const filterHref = (next: Partial<Record<"status" | "assignee", string | null>>) =>
    projectHref({ ...next, page: null });
  // L'écran tel qu'il est affiché : un ticket ouvert d'ici y ramène (CC-371).
  const retour = projectHref({});

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
          ← Projets
        </Link>
        {info ? (
          <p className="mt-2 rounded-lg border border-amber/30 bg-amber/5 px-4 py-2.5 text-sm text-text">
            {info}
          </p>
        ) : null}
        <div className="mt-2 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-xl font-semibold text-text">
              {projectLabel(project.client.name, project.name)}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">{project.description}</p>
            <CoverageBadges warrantyEndsAt={project.warrantyEndsAt} maintenanceEndsAt={project.maintenanceEndsAt} />
          </div>
          {/* La phase se change ICI. Elle ne vivait que dans « Modifier le
              projet », replié, dans l'onglet Fiche : la chefferie ne la
              trouvait pas. Le formulaire complet reste, pour le reste. */}
          {canEdit ? (
            <form action={updateProjectPhaseAction} className="flex shrink-0 items-end gap-2">
              <input type="hidden" name="projectId" value={project.id} />
              <label className="flex flex-col gap-1 text-[11px] text-muted">
                Phase
                <select name="group" defaultValue={project.group} className="input h-8 py-0 text-xs">
                  {(["DEV", "WAR", "MAI", "CLO"] as ProjectGroup[]).map((g) => (
                    <option key={g} value={g}>{GROUP_LABEL[g]}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-muted">
                Libellé
                <input
                  name="phaseLabel"
                  defaultValue={project.phaseLabel}
                  placeholder={GROUP_LABEL[project.group]}
                  className="input h-8 w-40 py-0 text-xs"
                />
              </label>
              <button
                type="submit"
                className="h-8 rounded-lg border border-border px-3 text-xs font-medium text-text transition hover:border-mint/50 hover:text-mint"
              >
                Changer
              </button>
            </form>
          ) : (
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${GROUP_BADGE_CLASS[project.group]}`}>
              {project.phaseLabel || GROUP_LABEL[project.group]}
            </span>
          )}
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
            href={projectHref({ view: null })}
            className={`rounded-md px-3 py-1.5 ${activeView === "list" ? "bg-mint/10 text-mint" : "text-muted"}`}
          >
            Liste
          </Link>
          <Link
            href={projectHref({ view: "kanban" })}
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
            <ImportJsonDisclosure projectId={project.id} team={team} />
            <TicketExportPanel people={ticketAssignees(tickets)} projectId={project.id} />
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

      {activeView !== "fiche" ? (
        <TicketFilters
          statusFilter={statusFilter}
          assigneeFilter={assigneeFilter}
          assignees={ticketAssignees(tickets)}
          shown={shownTickets.length}
          total={tickets.length}
          filterHref={filterHref}
        />
      ) : null}

      {activeView === "list" ? (
        <ListView
          epics={project.epics}
          projectId={project.id}
          team={team}
          canClose={user.role !== "DEV"}
          tickets={tickets}
          shownTickets={shownTickets}
          loosePage={paginate(shownTickets.filter((t) => !t.epicId), page, perPage)}
          perPage={perPage}
          pageHref={(p, per) => projectHref({ page: p > 1 ? String(p) : null, per: String(per) })}
          retour={retour}
        />
      ) : activeView === "kanban" ? (
        <KanbanView
          tickets={shownTickets}
          epicTitle={new Map(project.epics.map((e) => [e.id, e.title]))}
          retour={retour}
        />
      ) : (
        <FicheView project={project} deadline={deadline} apis={apis} questions={questions} clients={clients} canEdit={canEdit} />
      )}
    </div>
  );
}

// Les filtres s'appliquent à tous les tickets des vues Liste et Kanban, ceux
// des épics comme ceux qui n'en ont pas.
function TicketFilters({
  statusFilter,
  assigneeFilter,
  assignees,
  shown,
  total,
  filterHref,
}: {
  statusFilter: string[];
  assigneeFilter: string[];
  assignees: { id: string; name: string }[];
  shown: number;
  total: number;
  filterHref: (next: Partial<Record<"status" | "assignee", string | null>>) => string;
}) {
  const filtered = statusFilter.length > 0 || assigneeFilter.length > 0;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      <span className="font-medium text-muted">Tickets</span>
      <FilterGroup>
        <FilterLink href={filterHref({ status: null })} active={!statusFilter.length}>
          Tous statuts
        </FilterLink>
        {TICKET_STATUSES.map((s) => (
          <FilterLink key={s} href={filterHref({ status: toggleValue(statusFilter, s) })} active={statusFilter.includes(s)}>
            {STATUS_LABEL[s]}
          </FilterLink>
        ))}
      </FilterGroup>
      <FilterGroup>
        <FilterLink href={filterHref({ assignee: null })} active={!assigneeFilter.length}>
          Tous les assignés
        </FilterLink>
        {assignees.map((a) => (
          <FilterLink key={a.id} href={filterHref({ assignee: toggleValue(assigneeFilter, a.id) })} active={assigneeFilter.includes(a.id)}>
            {a.name}
          </FilterLink>
        ))}
        <FilterLink
          href={filterHref({ assignee: toggleValue(assigneeFilter, UNASSIGNED) })}
          active={assigneeFilter.includes(UNASSIGNED)}
        >
          Non assigné
        </FilterLink>
      </FilterGroup>
      <span className="ml-auto flex items-center gap-3 text-muted">
        {filtered ? `${shown} ticket${shown > 1 ? "s" : ""} sur ${total}` : `${total} ticket${total > 1 ? "s" : ""}`}
        {filtered ? (
          <Link href={filterHref({ status: null, assignee: null })} className="font-medium text-mint hover:underline">
            Réinitialiser les filtres
          </Link>
        ) : null}
      </span>
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
        {/* Visible d'emblée, pas replié dans « Modifier le projet » : c'est là
            que la phase se perdait (DEC-026). */}
        {canEdit ? (
          <div className="rounded-xl border border-border bg-panel p-5">
            <h2 className="text-sm font-semibold text-text">Garantie et maintenance</h2>
            <p className="mt-1 text-xs text-muted">
              Dernier jour couvert de chacune. Les deux se cumulent et ne dépendent pas de la
              phase ; une date vidée retire la couverture.
            </p>
            <form action={updateProjectCoverageAction} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="projectId" value={project.id} />
              <PField label="Fin de garantie">
                <input name="warrantyEndsAt" type="date" defaultValue={day(project.warrantyEndsAt)} className="input w-44" />
              </PField>
              <PField label="Fin de maintenance">
                <input name="maintenanceEndsAt" type="date" defaultValue={day(project.maintenanceEndsAt)} className="input w-44" />
              </PField>
              <button type="submit" className="rounded-lg bg-mint px-4 py-2 text-xs font-semibold text-bg">
                Enregistrer
              </button>
            </form>
          </div>
        ) : null}

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
                      {(["DEV", "WAR", "MAI", "CLO"] as ProjectGroup[]).map((g) => (
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
                  {/* Avec un montant vendu, les heures s'en déduisent au taux de
                      l'agence (CC-357) : on les montre sans les laisser saisir.
                      Le champ caché garde la valeur pour un projet sans prix. */}
                  <PField label="Heures vendues" hint={project.soldAmount ? "calculées" : undefined}>
                    {project.soldAmount ? (
                      <>
                        <input type="hidden" name="hoursSold" value={project.hoursSold} />
                        <p className="input text-muted">{fmtHours(project.hoursSold)}</p>
                      </>
                    ) : (
                      <input name="hoursSold" defaultValue={project.hoursSold} className="input" />
                    )}
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
                  L’avancement et les heures passées ne se saisissent pas : ils suivent les tickets et
                  les saisies de temps. Les heures vendues se déduisent du montant vendu, au taux
                  réglé dans « Rentabilité &amp; temps ». Passer la phase en « Clôturé » horodate la
                  clôture.
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

// Couverture après livraison, visible de toute l'équipe : un bug remonté sur
// un projet sous garantie ne se chiffre pas, sous maintenance il se décompte
// du contrat.
function CoverageBadges({ warrantyEndsAt, maintenanceEndsAt }: { warrantyEndsAt: Date | null; maintenanceEndsAt: Date | null }) {
  const items = [
    { label: "Garantie", status: coverageStatus(warrantyEndsAt) },
    { label: "Maintenance", status: coverageStatus(maintenanceEndsAt) },
  ].filter((i) => i.status);
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map(({ label, status }) => (
        <span
          key={label}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            !status!.active ? "bg-white/5 text-muted" : status!.days <= 30 ? "bg-amber/10 text-amber" : "bg-blue/10 text-blue"
          }`}
        >
          {label} {status!.text}
        </span>
      ))}
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

// Le numéro d'une référence (406 pour AD-406). Dans un épic, les tickets se
// suivent dans l'ordre de leur numérotation : les anciennes tâches ont été
// numérotées dans leur ordre d'affichage (CC-365), ce classement le leur
// conserve, et un ticket ajouté vient à la suite. Un tri sur le texte mettrait
// AD-1000 avant AD-301.
function refNumber(ref: string): number {
  const n = Number.parseInt(ref.slice(ref.lastIndexOf("-") + 1), 10);
  return Number.isFinite(n) ? n : 0;
}

function ListView({
  epics,
  projectId,
  team,
  canClose,
  tickets,
  shownTickets,
  loosePage,
  perPage,
  pageHref,
  retour,
}: {
  epics: ProjectEpic[];
  projectId: string;
  team: { id: string; name: string }[];
  // Clôturer un ticket revient à la chefferie et à la direction (DEC-007),
  // qu'il soit rangé dans un épic ou non.
  canClose: boolean;
  // Tous les tickets du projet, pour les décomptes et l'avancement des épics ;
  // `shownTickets` est la même liste filtrée, `loosePage` la page affichée des
  // tickets hors épic, filtres appliqués.
  tickets: ProjectTicketRow[];
  shownTickets: ProjectTicketRow[];
  loosePage: { rows: ProjectTicketRow[]; page: number; pageCount: number; total: number };
  perPage: number;
  pageHref: (page: number, perPage: number) => string;
  retour: string;
}) {
  const bulkBar = (
    <BulkBar
      team={team}
      statuses={TICKET_STATUSES.filter((s) => canClose || s !== "TERMINE")}
      note={canClose ? undefined : "la clôture revient à la chefferie de projet"}
    />
  );
  const loose = tickets.filter((t) => !t.epicId);
  const looseOpen = loose.filter((t) => t.status !== "TERMINE").length;

  return (
    <div className="flex flex-col gap-3">
      {epics.length === 0 ? (
        <p className="rounded-xl border border-border bg-panel px-5 py-6 text-sm text-muted">
          Aucun découpage en épics pour ce projet pour l’instant.
        </p>
      ) : (
        epics.map((epic) => {
          // L'avancement et les heures de l'épic portent sur TOUS ses tickets ;
          // les filtres ne réduisent que la liste affichée.
          const all = tickets.filter((t) => t.epicId === epic.id);
          const rows = shownTickets
            .filter((t) => t.epicId === epic.id)
            .sort((a, b) => refNumber(a.ref) - refNumber(b.ref));
          const spent = all.reduce((s, t) => s + t.spentHours, 0);
          const est = epic.estHours || all.reduce((s, t) => s + t.estHours, 0);
          const done = all.filter((t) => t.status === "TERMINE").length;
          const pct = all.length ? Math.round((done / all.length) * 100) : 0;
          return (
            <details key={epic.id} className="group rounded-xl border border-border bg-panel open:pb-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-muted transition group-open:rotate-90">▶</span>
                  <span className="truncate text-sm font-medium text-text">{epic.title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-6 text-xs text-muted">
                  <span>{epic.lead?.name ?? "Non assigné"}</span>
                  <span>
                    {all.length} ticket{all.length > 1 ? "s" : ""}
                  </span>
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
              {/* Un épic mal nommé, une estimation à refaire, un responsable
                  qui change : l'API l'acceptait déjà, rien ne l'appelait. */}
              <details className="border-t border-border px-5 py-2">
                <summary className="cursor-pointer text-xs font-medium text-mint">Modifier l’épic</summary>
                <form action={updateEpicAction} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="epicId" value={epic.id} />
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Nom
                    <input name="title" defaultValue={epic.title} required className="input w-56" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Objectif
                    <input name="objective" defaultValue={epic.objective ?? ""} className="input w-56" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Budget (h)
                    <input
                      name="estHours"
                      defaultValue={String(epic.estHours).replace(".", ",")}
                      className="input w-24"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Responsable
                    <select name="leadId" defaultValue={epic.leadId ?? ""} className="input w-44">
                      <option value="">Non assigné</option>
                      {team.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Échéance
                    <input
                      name="dueAt"
                      type="date"
                      defaultValue={epic.dueAt ? new Date(epic.dueAt).toISOString().slice(0, 10) : ""}
                      className="input w-36"
                    />
                  </label>
                  <button type="submit" className="rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">
                    Enregistrer
                  </button>
                </form>
                {/* Supprimer un épic ne supprime aucun ticket : ils restent au
                    projet, hors épic. */}
                <form action={deleteEpicAction.bind(null, epic.id, projectId)} className="mt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    className="rounded-lg border border-red/40 px-3 py-1.5 text-xs font-medium text-red transition hover:bg-red/10"
                  >
                    Supprimer l’épic
                  </button>
                  {all.length > 0 ? (
                    <span className="text-xs text-muted">
                      Ses {all.length} ticket{all.length > 1 ? "s" : ""} resteront au projet, hors épic.
                    </span>
                  ) : null}
                </form>
              </details>
              <div className="border-t border-border px-5 py-3">
                {/* Une sélection par épic : le bandeau apparaît au-dessus de
                    l'épic où l'on coche, pas en haut d'une page qu'on a
                    quittée. Même action que l'écran Tickets (CC-358). */}
                {rows.length > 0 ? (
                  <BulkSelection action={bulkUpdateTicketsAction} field="ticketIds" bar={bulkBar}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <TicketTable rows={rows} retour={retour} />
                  </BulkSelection>
                ) : (
                  <p className="py-1 text-sm text-muted">
                    {all.length ? "Aucun ticket de cet épic pour ces filtres." : "Aucun ticket dans cet épic."}
                  </p>
                )}
                <NewEpicTicketDisclosure projectId={projectId} epicId={epic.id} team={team} />
              </div>
            </details>
          );
        })
      )}

      {/* Les tickets qui ne relèvent d'aucun épic : bugs remontés en cours de
          route, demandes ponctuelles. Ils forment leur propre bloc, paginé. */}
      <div className="rounded-xl border border-border bg-panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-text">Tickets hors épic</h2>
          <span className="text-xs text-muted">
            {looseOpen} ouvert{looseOpen > 1 ? "s" : ""} sur {loose.length}
          </span>
        </div>
        {loose.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Aucun ticket hors épic sur ce projet.</p>
        ) : loosePage.total === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Aucun ticket hors épic pour ces filtres.</p>
        ) : (
          // Il porte sur la page affichée, filtres compris.
          <BulkSelection
            action={bulkUpdateTicketsAction}
            field="ticketIds"
            className="flex flex-col"
            barClassName="mx-5 mt-3"
            bar={bulkBar}
          >
            <input type="hidden" name="projectId" value={projectId} />
            <div className="px-5">
              <TicketTable rows={loosePage.rows} retour={retour} />
            </div>
          </BulkSelection>
        )}
        {loosePage.total > 0 ? (
          <div className="border-t border-border px-5 py-3">
            <Pagination
              page={loosePage.page}
              pageCount={loosePage.pageCount}
              perPage={perPage}
              total={loosePage.total}
              hrefFor={pageHref}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Une ligne par ticket, avec sa case de sélection : la même table sert aux
// épics et au bloc « hors épic ».
function TicketTable({ rows, retour }: { rows: ProjectTicketRow[]; retour: string }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted">
          <th className="w-8 py-1.5 pr-3 font-medium">
            <SelectAll field="ticketIds" />
          </th>
          <th className="py-1.5 pr-4 font-medium">Réf.</th>
          <th className="py-1.5 pr-4 font-medium">Type</th>
          <th className="py-1.5 pr-4 font-medium">Titre</th>
          <th className="py-1.5 pr-4 font-medium">Gravité · nature</th>
          <th className="py-1.5 pr-4 font-medium">Assigné</th>
          <th className="py-1.5 pr-4 text-right font-medium">Temps</th>
          <th className="py-1.5 text-right font-medium">Statut</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((t) => (
          <tr key={t.id} className="transition hover:bg-panel-2">
            <td className="py-2 pr-3">
              <input
                type="checkbox"
                name="ticketIds"
                value={t.id}
                aria-label={`Sélectionner ${t.ref}`}
                className="accent-mint"
              />
            </td>
            <td className="whitespace-nowrap py-2 pr-4">
              <Link href={ticketHref(t.ref, retour)} className="font-medium text-text hover:text-mint">
                {t.ref}
              </Link>
            </td>
            <td className="whitespace-nowrap py-2 pr-4">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TICKET_TYPE_BADGE_CLASS[t.type]}`}>
                {TICKET_TYPE_LABEL[t.type]}
              </span>
            </td>
            <td className="py-2 pr-4">
              <Link href={ticketHref(t.ref, retour)} className="text-text hover:text-mint">
                {t.title}
              </Link>
            </td>
            <td className="whitespace-nowrap py-2 pr-4 text-xs text-muted">
              {t.severity ? SEVERITY_LABEL[t.severity] : t.devNature ? DEV_NATURE_LABEL[t.devNature] : "—"}
            </td>
            <td className="whitespace-nowrap py-2 pr-4 text-muted">{t.assignee?.name ?? "Non assigné"}</td>
            <td className="whitespace-nowrap py-2 pr-4 text-right text-muted">
              {fmtHours(t.spentHours)} / {fmtHours(t.estHours)}
            </td>
            <td className="whitespace-nowrap py-2 text-right">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[t.status]}`}>
                {STATUS_LABEL[t.status]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Ce que le bandeau de sélection pose sur toutes les lignes cochées : un statut,
// un assigné, ou les deux. Les noms de champs sont ceux que relit l'action de
// masse des tickets.
function BulkBar({
  team,
  statuses,
  note,
}: {
  team: { id: string; name: string }[];
  statuses: TaskStatus[];
  note?: string;
}) {
  return (
    <>
      <select name="bulkStatus" className="input h-8 w-auto py-0 text-xs" aria-label="Statut à poser">
        <option value="">Statut inchangé</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <select name="bulkAssignee" className="input h-8 w-auto py-0 text-xs" aria-label="Assigné à poser">
        <option value="">Assigné inchangé</option>
        <option value="__aucun__">Retirer l’assigné</option>
        {team.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg transition hover:brightness-110"
      >
        Appliquer
      </button>
      {note ? <span className="text-muted">{note}</span> : null}
    </>
  );
}

const KANBAN_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "A_FAIRE", label: "À faire" },
  { status: "EN_COURS", label: "En cours" },
  { status: "EN_REVUE", label: "En revue" },
  { status: "TERMINE", label: "Terminé" },
];

function KanbanView({
  tickets,
  epicTitle,
  retour,
}: {
  tickets: ProjectTicketRow[];
  epicTitle: Map<string, string>;
  retour: string;
}) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((col) => {
        const items = tickets.filter((t) => t.status === col.status);
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
                  href={ticketHref(t.ref, retour)}
                  className="rounded-lg border border-border bg-panel-2 p-3 text-sm transition hover:border-mint/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted">{t.ref}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TICKET_TYPE_BADGE_CLASS[t.type]}`}>
                      {TICKET_TYPE_LABEL[t.type]}
                    </span>
                  </div>
                  <p className="mt-1 text-text">{t.title}</p>
                  {t.epicId ? <p className="mt-1 text-xs text-muted">{epicTitle.get(t.epicId)}</p> : null}
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

const IMPORT_EXAMPLE = `{
  "epics": [
    {
      "title": "Lot 1 — Cadrage",
      "estHours": 20
    }
  ],
  "tickets": [
    {
      "type": "DEV",
      "title": "Atelier de lancement",
      "estHours": 4,
      "epic": "Lot 1 — Cadrage"
    },
    {
      "type": "BUG",
      "title": "Le formulaire ne s’envoie pas",
      "steps": "1. Ouvrir la page\\n2. Valider",
      "severity": "MAJEUR",
      "estHours": 2,
      "epic": "Lot 1 — Cadrage"
    }
  ]
}`;

// Import en masse. Un épic dont le titre existe déjà est réutilisé et non
// dupliqué : réimporter un fichier corrigé ne crée pas un second « Lot 1 ».
function ImportJsonDisclosure({ projectId, team }: { projectId: string; team: { id: string; name: string }[] }) {
  return (
    <Popover
      summary="Importer du JSON"
      summaryClassName="cursor-pointer list-none rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted transition hover:text-text"
    >
      <form
        action={importProjectJsonAction}
        className="absolute right-0 z-10 mt-2 flex w-[32rem] flex-col gap-2 rounded-xl border border-border bg-panel p-4 shadow-2xl"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <p className="text-xs text-muted">
          Épics et tickets d’un coup. Seuls les titres sont obligatoires ; un épic
          déjà présent est réutilisé, et les tickets reçoivent leur référence
          automatiquement. Les entrées « tasks » d’un épic deviennent des tickets
          « Développement » de cet épic.
        </p>
        <textarea
          name="payload"
          required
          rows={12}
          defaultValue=""
          placeholder={IMPORT_EXAMPLE}
          className="input min-h-[240px] resize-y font-mono text-xs"
        />
        {/* Les tickets importés partaient tous sans assigné : il fallait
            ensuite les reprendre un par un (CC-354). « Personne » reste le
            défaut, pour qui préfère les distribuer après coup. */}
        <label className="flex items-center justify-between gap-3 text-xs text-muted">
          Assigner les tickets créés à
          <select name="ticketAssigneeId" defaultValue="" className="input h-8 w-56 py-0 text-xs">
            <option value="">Personne (à distribuer)</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
          Importer
        </button>
      </form>
    </Popover>
  );
}

function NewEpicDisclosure({ projectId, team }: { projectId: string; team: { id: string; name: string }[] }) {
  return (
    <Popover
      summary="+ Nouvel épic"
      summaryClassName="cursor-pointer list-none rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg"
    >
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
    </Popover>
  );
}

// Ajouter un ticket à un épic sans quitter la fiche : titre, type, estimation,
// assigné. Le reste (description, gravité, échéance…) se complète sur la fiche
// du ticket. Il reçoit les critères d'acceptation de départ, comme tout ticket.
function NewEpicTicketDisclosure({
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
      <summary className="cursor-pointer list-none text-xs font-medium text-mint">+ Ticket dans cet épic</summary>
      <form action={createEpicTicketAction} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="epicId" value={epicId} />
        <label className="text-xs text-muted">
          Titre
          <input name="title" required className="mt-1 block w-56 rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-text" />
        </label>
        <label className="text-xs text-muted">
          Type
          <select name="type" defaultValue="DEV" className="mt-1 block w-36 rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-text">
            <option value="DEV">{TICKET_TYPE_LABEL.DEV}</option>
            <option value="BUG">{TICKET_TYPE_LABEL.BUG}</option>
          </select>
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
