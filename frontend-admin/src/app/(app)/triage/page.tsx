import Link from "next/link";
import { Suspense } from "react";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { fmtHours, TRIAGE_STATE_LABEL, TRIAGE_STATE_BADGE_CLASS, SEVERITY_LABEL, TICKET_TYPE_LABEL } from "@/lib/format";
import { qualifyTicketAction, reopenTriageAction, addTriageReplyAction } from "./actions";
import type { TriageScreen, TriageDetailRow, TriageDraft, Tone } from "./types";
import type { TriageState } from "@/lib/types";

const FILTERS: { id: "all" | TriageState; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "A_QUALIFIER", label: "À qualifier" },
  { id: "A_CHIFFRER", label: "À chiffrer" },
  { id: "TRANSMIS", label: "Transmis" },
  { id: "DEVIS_ENVOYE", label: "Devis envoyé" },
  { id: "CLOS", label: "Clos" },
];
const TONES: Tone[] = ["Neutre", "Rassurant", "Ferme"];

export default async function TriagePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; ref?: string; tone?: string; ai?: string }>;
}) {
  await requireRole("PM", "DIR");
  const sp = await searchParams;
  const filter = (sp.filter as TriageState | undefined) ?? "all";
  const tone: Tone = (sp.tone as Tone) ?? "Neutre";
  const aiRequested = sp.ai === "1";

  // Le backend renvoie la liste et, dans la même requête, le détail du ticket
  // sélectionné — `?ref=` désigne lequel, à défaut c'est le premier.
  const { all, team, detail } = await apiGet<TriageScreen>(
    `/api/admin/triage${sp.ref ? `?ref=${encodeURIComponent(sp.ref)}` : ""}`,
  );
  const filtered = filter === "all" ? all : all.filter((t) => t.triageState === filter);
  const counts: Record<string, number> = { all: all.length };
  for (const f of FILTERS) if (f.id !== "all") counts[f.id] = all.filter((t) => t.triageState === f.id).length;

  const selected = detail;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Remontées client</h1>
        <p className="mt-1 text-sm text-muted">
          {counts.A_QUALIFIER ?? 0} à qualifier · {all.length} remontées au total
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "all" ? "/triage" : `/triage?filter=${f.id}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === f.id ? "border-mint/40 bg-mint/10 text-text" : "border-border text-muted hover:text-text"
            }`}
          >
            {f.label} · {counts[f.id] ?? 0}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2 flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-panel">
          {filtered.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Aucune remontée pour ce filtre.</p>
          ) : (
            filtered.map((t) => (
              <Link
                key={t.id}
                href={`/triage?ref=${t.ref}${filter !== "all" ? `&filter=${filter}` : ""}`}
                className={`flex flex-col gap-1.5 px-4 py-3 text-sm transition hover:bg-panel-2 ${selected?.id === t.id ? "bg-panel-2" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-text">{t.project.client.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TRIAGE_STATE_BADGE_CLASS[t.triageState]}`}>
                    {TRIAGE_STATE_LABEL[t.triageState]}
                  </span>
                </div>
                <p className="truncate text-muted">{t.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>{TICKET_TYPE_LABEL[t.type]}</span>
                  {t.severity ? <span>· {SEVERITY_LABEL[t.severity]}</span> : null}
                  <span>· {fmtHours(t.estHours)}</span>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="col-span-3">
          {detail ? (
            <TriageDetail detail={detail} tone={tone} aiRequested={aiRequested} team={team} filter={filter} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-border bg-panel px-5 py-10 text-sm text-muted">
              Sélectionnez une remontée.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function TriageDetail({
  detail: t,
  tone,
  aiRequested,
  team,
  filter,
}: {
  detail: TriageDetailRow;
  tone: Tone;
  aiRequested: boolean;
  team: { id: string; name: string }[];
  filter: string;
}) {
  const isClosed = t.triageState === "CLOS";
  const title = isClosed
    ? "Ticket clos"
    : t.type === "DEV"
      ? "Chiffrer et envoyer le devis"
      : "Qualifier et transmettre au dev";
  const nextState = t.type === "DEV" ? (t.triageState === "A_CHIFFRER" ? "DEVIS_ENVOYE" : "A_CHIFFRER") : "TRANSMIS";
  const actionLabel = t.type === "DEV" ? (t.triageState === "A_CHIFFRER" ? "Envoyer le devis" : "Chiffrer") : "Transmettre au dev";
  const query = filter !== "all" ? `&filter=${filter}` : "";
  // Tone switches preserve whether the AI was already invoked, so re-opting-in isn't required —
  // but a fresh ticket (or a tone pick before ever clicking "Générer") never calls Gemini on its own.
  const aiQuery = aiRequested ? "&ai=1" : "";


  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-panel p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted">
              {t.project.client.name} · {t.project.client.contactName ?? "contact client"}
            </p>
            <h2 className="mt-1 text-base font-semibold text-text">{t.title}</h2>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${TRIAGE_STATE_BADGE_CLASS[t.triageState]}`}>
            {TRIAGE_STATE_LABEL[t.triageState]}
          </span>
        </div>
        <p className="mt-3 text-sm text-muted">{t.description}</p>
        {t.attachments.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {t.attachments.map((f) => (
              <span key={f.id} className="rounded-lg border border-border bg-panel-2 px-2.5 py-1 text-xs text-muted">
                {f.filename}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {isClosed ? (
          <form action={reopenTriageAction.bind(null, t.id)} className="mt-3">
            <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-text">
              Rouvrir le ticket
            </button>
          </form>
        ) : (
          <form action={qualifyTicketAction} className="mt-3 grid grid-cols-2 gap-3">
            <input type="hidden" name="ticketId" value={t.id} />
            <input type="hidden" name="nextState" value={nextState} />
            <label className="flex flex-col gap-1 text-xs text-muted">
              Module
              <input name="module" defaultValue={t.module ?? ""} className="rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-text" />
            </label>
            {t.type === "BUG" ? (
              <label className="flex flex-col gap-1 text-xs text-muted">
                Gravité
                <select name="severity" defaultValue={t.severity ?? "MINEUR"} className="rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-text">
                  <option value="MINEUR">Mineur</option>
                  <option value="MAJEUR">Majeur</option>
                  <option value="BLOQUANT">Bloquant</option>
                </select>
              </label>
            ) : (
              <div />
            )}
            <label className="flex flex-col gap-1 text-xs text-muted">
              Assigné
              <select name="assigneeId" defaultValue={t.assigneeId ?? ""} className="rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-text">
                <option value="">Non assigné</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Estimation (h)
              <input name="estHours" defaultValue={t.estHours} className="rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-sm text-text" />
            </label>
            <button type="submit" className="col-span-2 mt-1 rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-bg">
              {actionLabel}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Réponse proposée par l’IA</h3>
          <div className="flex gap-1 rounded-lg border border-border p-0.5 text-xs">
            {TONES.map((tn) => (
              <Link
                key={tn}
                href={`/triage?ref=${t.ref}${query}&tone=${tn}${aiQuery}`}
                className={`rounded-md px-2 py-1 ${tone === tn ? "bg-panel-2 text-text" : "text-muted"}`}
              >
                {tn}
              </Link>
            ))}
          </div>
        </div>
        {aiRequested ? (
          // Keyed by ref+tone so switching either restarts the suspense fallback instead of showing stale text.
          <Suspense key={`${t.ref}:${tone}`} fallback={<AiDraftSkeleton />}>
            <AiDraftCard ticketId={t.id} tone={tone} />
          </Suspense>
        ) : (
          <TemplateDraftCard ticketId={t.id} tone={tone} refValue={t.ref} query={query} />
        )}
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <h3 className="text-sm font-semibold text-text">Échanges avec le client</h3>
        <div className="mt-3 flex flex-col gap-3">
          {t.triageReplies.map((r) => (
            <div key={r.id} className={`rounded-lg border px-3 py-2 text-sm ${r.mine ? "border-mint/30 bg-mint/5" : "border-border bg-panel-2"}`}>
              <p className="text-xs text-muted">{r.authorLabel}</p>
              <p className="mt-0.5 text-text">{r.body}</p>
            </div>
          ))}
          {t.triageReplies.length === 0 ? <p className="text-sm text-muted">Aucun échange pour l’instant.</p> : null}
        </div>
        <form action={addTriageReplyAction} className="mt-3 flex gap-2">
          <input type="hidden" name="ticketId" value={t.id} />
          <input name="body" required placeholder="Répondre au client…" className="flex-1 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text" />
          <button type="submit" className="rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">Envoyer</button>
        </form>
      </div>
    </div>
  );
}

// Isolated in its own Suspense boundary so a slow (or unconfigured) AI call
// never blocks the ticket description, qualification form, or échanges below.
async function AiDraftCard({ ticketId, tone }: { ticketId: string; tone: Tone }) {
  const draft = await apiGet<TriageDraft>(
    `/api/admin/triage/draft?ticketId=${ticketId}&tone=${tone}&ai=1`,
  );
  return (
    <>
      <div className="mt-3 flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${draft.source === "gemini" ? "bg-blue/10 text-blue" : "bg-white/5 text-muted"}`}>
          {draft.source === "gemini" ? "Gemini" : "brouillon type"}
        </span>
      </div>
      <p className="mt-2 text-sm text-text">{draft.text}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {draft.basis.map((b) => (
          <span key={b} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted">{b}</span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Vous validez avant tout envoi — rien ne part automatiquement depuis cet écran.</p>
    </>
  );
}

// Shown by default: the deterministic template, with an explicit opt-in to spend a Gemini
// call. Gemini's free tier caps out at 20 requests/day, so drafting stays free-by-default
// and only calls out when someone actually asks for an AI-written version.
async function TemplateDraftCard({ ticketId, tone, refValue, query }: { ticketId: string; tone: Tone; refValue: string; query: string }) {
  // Même route, sans `ai=1` : elle renvoie le gabarit déterministe, qui ne
  // consomme aucun appel Gemini.
  const draft = await apiGet<TriageDraft>(
    `/api/admin/triage/draft?ticketId=${ticketId}&tone=${tone}`,
  );
  return (
    <>
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted">brouillon type</span>
      </div>
      <p className="mt-2 text-sm text-text">{draft.text}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {draft.basis.map((b) => (
          <span key={b} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted">{b}</span>
        ))}
      </div>
      <Link
        href={`/triage?ref=${refValue}${query}&tone=${tone}&ai=1`}
        className="mt-3 inline-block rounded-lg border border-blue/30 px-3 py-1.5 text-xs font-medium text-blue hover:bg-blue/10"
      >
        Générer un brouillon avec l’IA (Gemini)
      </Link>
      <p className="mt-3 text-xs text-muted">Vous validez avant tout envoi — rien ne part automatiquement depuis cet écran.</p>
    </>
  );
}

function AiDraftSkeleton() {
  return (
    <div className="mt-3 animate-pulse space-y-2">
      <div className="h-3 w-24 rounded bg-white/5" />
      <div className="h-3 w-full rounded bg-white/5" />
      <div className="h-3 w-4/5 rounded bg-white/5" />
      <div className="h-3 w-2/3 rounded bg-white/5" />
    </div>
  );
}
