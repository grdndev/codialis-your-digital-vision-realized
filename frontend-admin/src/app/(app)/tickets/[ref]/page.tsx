import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { fmtHours, fmtDate, STATUS_BADGE_CLASS, STATUS_LABEL, TICKET_TYPE_BADGE_CLASS, TICKET_TYPE_LABEL, SEVERITY_LABEL, DEV_NATURE_LABEL, projectLabel, authorName, authorInitials } from "@/lib/format";
import {
  setTicketStatusAction,
  updateTicketAction,
  toggleTicketCriterionAction,
  addTicketCriterionAction,
  updateTicketCriterionAction,
  deleteTicketCriterionAction,
  addTicketCommentAction,
  deleteTicketAction,
} from "../actions";
import type { TicketDetailResponse } from "../types";
import type { TaskStatus } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = {
  A_FAIRE: "Démarrer",
  EN_COURS: "Passer en revue",
  EN_REVUE: "Clôturer",
};

// Toutes les colonnes sont atteignables, y compris en arrière.
const STATUSES: TaskStatus[] = ["A_FAIRE", "EN_COURS", "EN_REVUE", "TERMINE"];

const NEXT: Record<string, TaskStatus | undefined> = {
  A_FAIRE: "EN_COURS",
  EN_COURS: "EN_REVUE",
  EN_REVUE: "TERMINE",
};

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ info?: string }>;
}) {
  const user = await requireUser();
  // Un développeur va jusqu'à « En revue » : la clôture appartient à la
  // chefferie de projet et à la direction.
  const canClose = user.role !== "DEV";
  const { ref } = await params;
  const { info } = await searchParams;

  const { ticket, epics, team, projects } = await apiGet<TicketDetailResponse>(
    `/api/admin/tickets/detail?ref=${encodeURIComponent(ref)}`,
  );
  if (!ticket) notFound();

  const advanceLabel =
    ticket.status === "EN_REVUE" && !canClose ? undefined : ACTION_LABEL[ticket.status];
  const stepList = ticket.steps.split("\n").filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/tickets" className="text-sm text-muted hover:text-text">
        ← Tickets
      </Link>

      {info ? (
        <p className="rounded-lg border border-amber/30 bg-amber/5 px-4 py-2.5 text-sm text-text">
          {info}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-text">{ticket.ref}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${TICKET_TYPE_BADGE_CLASS[ticket.type]}`}>
                    {TICKET_TYPE_LABEL[ticket.type]}
                  </span>
                </div>
                <h1 className="mt-1 text-lg font-semibold text-text">{ticket.title}</h1>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[ticket.status]}`}>
                {STATUS_LABEL[ticket.status]}
              </span>
            </div>
            <p className="mt-4 text-sm text-muted">{ticket.description}</p>

            <details className="mt-4 border-t border-border pt-3">
              <summary className="cursor-pointer text-xs font-medium text-mint">
                Modifier le ticket
              </summary>
              <form action={updateTicketAction} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Projet" hint="déplacer le ticket">
                    <select name="projectId" defaultValue={ticket.project.id} className="input">
                      {(projects ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {projectLabel(p.client.name, p.name)}
                        </option>
                      ))}
                    </select>
                  </EditField>
                  <EditField label="Type">
                    <select name="type" defaultValue={ticket.type} className="input">
                      <option value="BUG">{TICKET_TYPE_LABEL.BUG}</option>
                      <option value="DEV">{TICKET_TYPE_LABEL.DEV}</option>
                    </select>
                  </EditField>
                </div>
                <p className="text-xs text-muted">
                  Changer de projet renumérote le ticket au préfixe du projet d’accueil —
                  {" "}{ticket.ref} deviendra autre chose — et détache son épic.
                </p>
                <EditField label="Titre">
                  <input name="title" required defaultValue={ticket.title} className="input" />
                </EditField>
                <EditField label="Description">
                  <textarea name="description" rows={3} defaultValue={ticket.description} className="input" />
                </EditField>
                <EditField
                  label={ticket.type === "BUG" ? "Étapes de reproduction" : "Travail à réaliser"}
                  hint="une par ligne"
                >
                  <textarea name="steps" rows={3} defaultValue={ticket.steps} className="input" />
                </EditField>
                <div className="grid grid-cols-2 gap-3">
                  {/* Gravité pour un bug, nature pour un développement : le
                      type ne se change pas, la référence en découle. */}
                  {/* Les deux champs sont proposés : le type se change, et
                      l'API garde celui qui correspond au type retenu. */}
                  <EditField label="Gravité" hint="bug">
                    <select name="severity" defaultValue={ticket.severity ?? ""} className="input">
                      <option value="">—</option>
                      {(["BLOQUANT", "MAJEUR", "MINEUR"] as const).map((k) => (
                        <option key={k} value={k}>
                          {SEVERITY_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </EditField>
                  <EditField label="Nature" hint="développement">
                    <select name="devNature" defaultValue={ticket.devNature ?? ""} className="input">
                      <option value="">—</option>
                      {(["FRONT", "BACK", "API", "DESIGN"] as const).map((k) => (
                        <option key={k} value={k}>
                          {DEV_NATURE_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </EditField>
                  <EditField label="Estimé (h)">
                    <input name="estHours" defaultValue={ticket.estHours} className="input" />
                  </EditField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Assigné">
                    <select name="assigneeId" defaultValue={ticket.assigneeId ?? ""} className="input">
                      <option value="">Non assigné</option>
                      {(team ?? []).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </EditField>
                  <EditField label="Épic">
                    <select name="epicId" defaultValue={ticket.epicId ?? ""} className="input">
                      <option value="">Aucun</option>
                      {(epics ?? []).map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title}
                        </option>
                      ))}
                    </select>
                  </EditField>
                </div>
                <button
                  type="submit"
                  className="self-start rounded-lg bg-mint px-4 py-2 text-xs font-semibold text-bg"
                >
                  Enregistrer
                </button>
              </form>
            </details>
          </div>

          {stepList.length > 0 ? (
            <div className="rounded-xl border border-border bg-panel p-5">
              <h2 className="text-sm font-semibold text-text">
                {ticket.type === "BUG" ? "Étapes de reproduction" : "Travail à réaliser"}
              </h2>
              <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-4 text-sm text-muted">
                {stepList.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {ticket.attachments.length > 0 ? (
            <div className="rounded-xl border border-border bg-panel p-5">
              <h2 className="text-sm font-semibold text-text">Pièces jointes</h2>
              <div className="mt-3 flex flex-col gap-2">
                {ticket.attachments.map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
                    <span className="text-text">{f.filename}</span>
                    <span className="text-xs text-muted">{f.meta}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-panel p-5">
            <h2 className="text-sm font-semibold text-text">Critères d’acceptation</h2>
            <div className="mt-3 flex flex-col gap-1">
              {ticket.criteria.length === 0 ? (
                <p className="py-1 text-sm text-muted">Aucun critère pour l’instant.</p>
              ) : (
                ticket.criteria.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-panel-2">
                    {/* Cocher reste un geste à part : un bouton, pas un champ. */}
                    <form action={toggleTicketCriterionAction.bind(null, c.id, ref)}>
                      <button
                        type="submit"
                        title={c.done ? "Décocher" : "Cocher"}
                        className={`px-1 text-sm ${c.done ? "text-mint" : "text-muted hover:text-text"}`}
                      >
                        {c.done ? "☑" : "☐"}
                      </button>
                    </form>
                    {/* Le libellé s'édite sur place : la saisie EST l'affichage,
                        et l'enregistrement se fait à la validation du champ. */}
                    <form action={updateTicketCriterionAction} className="flex-1">
                      <input type="hidden" name="criterionId" value={c.id} />
                      <input
                        name="label"
                        defaultValue={c.label}
                        className={`w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none focus:border-border focus:bg-panel-2 ${c.done ? "text-muted line-through" : "text-text"}`}
                      />
                    </form>
                    <form action={deleteTicketCriterionAction.bind(null, c.id)}>
                      <button
                        type="submit"
                        title="Supprimer ce critère"
                        className="px-1 text-xs text-muted transition hover:text-red"
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
            <form action={addTicketCriterionAction} className="mt-3 flex gap-2">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <input
                name="label"
                required
                placeholder="Ajouter un critère…"
                className="flex-1 rounded-lg border border-border bg-panel-2 px-3 py-1.5 text-sm text-text outline-none focus:border-mint"
              />
              <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-text">
                Ajouter
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-border bg-panel p-5">
            <h2 className="text-sm font-semibold text-text">Commentaires internes</h2>
            <div className="mt-3 flex flex-col gap-3">
              {ticket.comments.map((c) => (
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
              {ticket.comments.length === 0 ? <p className="text-sm text-muted">Aucun commentaire pour l’instant.</p> : null}
            </div>
            <form action={addTicketCommentAction} className="mt-4 flex gap-2">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <input type="hidden" name="ref" value={ref} />
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
              <Row label="Projet" value={projectLabel(ticket.project.client.name, ticket.project.name)} />
              <Row label="Épic" value={ticket.epic?.title ?? "—"} />
              {ticket.severity ? <Row label="Gravité" value={SEVERITY_LABEL[ticket.severity]} /> : null}
              {ticket.devNature ? <Row label="Nature" value={DEV_NATURE_LABEL[ticket.devNature]} /> : null}
              <Row label="Assigné" value={ticket.assignee?.name ?? "Non assigné"} />
              <Row label="Créé par" value={ticket.creator?.name ?? "—"} />
              <Row label="Estimé" value={fmtHours(ticket.estHours)} />
              <Row label="Passé" value={fmtHours(ticket.spentHours)} />
              <Row label="Créé le" value={fmtDate(ticket.createdAt) ?? "—"} />
            </dl>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-panel p-5">
            {advanceLabel ? (
              <form action={setTicketStatusAction.bind(null, ticket.id, NEXT[ticket.status]!, true)}>
                <button type="submit" className="w-full rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-bg">
                  {advanceLabel}
                </button>
              </form>
            ) : null}

            <p className="mt-1 text-xs text-muted">Changer de statut</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.filter((s) => s !== ticket.status)
                .filter((s) => canClose || s !== "TERMINE")
                .map((s) => (
                <form key={s} action={setTicketStatusAction.bind(null, ticket.id, s, true)}>
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
              {ticket.status === "EN_COURS"
                ? "Le chronomètre tourne : le temps est compté pour l’assigné, dans ses horaires, et partagé avec ses autres tâches en cours."
                : "Passer le ticket à « En cours » démarre le chronomètre."}
            </p>
            {/* Supprimer emporte critères, commentaires et pièces jointes. Les
                heures déjà saisies restent au projet : le travail a eu lieu. */}
            <details className="mt-2 border-t border-border pt-2">
              <summary className="cursor-pointer text-xs text-muted hover:text-red">
                Supprimer ce ticket
              </summary>
              <p className="mt-2 text-xs text-muted">
                Ses critères, commentaires et pièces jointes partent avec lui. Les heures
                déjà saisies restent imputées au projet.
              </p>
              <form action={deleteTicketAction.bind(null, ticket.id)} className="mt-2">
                <button
                  type="submit"
                  className="w-full rounded-lg border border-red/40 px-3 py-2 text-xs font-medium text-red transition hover:bg-red/10"
                >
                  Supprimer définitivement {ticket.ref}
                </button>
              </form>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditField({
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="truncate text-right text-text">{value}</dd>
    </div>
  );
}
