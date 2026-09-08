import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import {
  fmtHours,
  fmtDate,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  TICKET_TYPE_BADGE_CLASS,
  TICKET_TYPE_LABEL,
  SEVERITY_LABEL,
  DEV_NATURE_LABEL,
} from "@/lib/format";
import { updateTicketStatusAction, toggleTicketCriterionAction, addTicketCommentAction } from "../actions";
import type { TicketDetailResponse } from "../types";

const ACTION_LABEL: Record<string, string> = {
  A_FAIRE: "Démarrer",
  EN_COURS: "Passer en revue",
  EN_REVUE: "Clôturer",
};

export default async function TicketDetailPage({ params }: { params: Promise<{ ref: string }> }) {
  await requireUser();
  const { ref } = await params;

  const { ticket } = await apiGet<TicketDetailResponse>(
    `/api/admin/tickets/detail?ref=${encodeURIComponent(ref)}`,
  );
  if (!ticket) notFound();

  const advanceLabel = ACTION_LABEL[ticket.status];
  const stepList = ticket.steps.split("\n").filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/tickets" className="text-sm text-muted hover:text-text">
        ← Tickets
      </Link>

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

          {ticket.criteria.length > 0 ? (
            <div className="rounded-xl border border-border bg-panel p-5">
              <h2 className="text-sm font-semibold text-text">Critères d’acceptation</h2>
              <div className="mt-3 flex flex-col gap-2">
                {ticket.criteria.map((c) => (
                  <form key={c.id} action={toggleTicketCriterionAction.bind(null, c.id, ref)}>
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
              {ticket.comments.map((c) => (
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
              <Row label="Projet" value={`${ticket.project.client.name} — ${ticket.project.name}`} />
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
              <form action={updateTicketStatusAction.bind(null, ticket.id, "advance")}>
                <button type="submit" className="w-full rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-bg">
                  {advanceLabel}
                </button>
              </form>
            ) : (
              <form action={updateTicketStatusAction.bind(null, ticket.id, "reopen")}>
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
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="truncate text-right text-text">{value}</dd>
    </div>
  );
}
