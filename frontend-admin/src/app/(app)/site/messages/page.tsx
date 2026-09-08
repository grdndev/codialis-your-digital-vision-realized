import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { setContactStatusAction, deleteContactAction, deleteSubscriberAction } from "../actions";
import { CONTACT_STATUS_CLASS, CONTACT_STATUS_LABEL, type SiteInboxScreen } from "../types";

// Transitions proposées depuis chaque statut : on ne montre que les boutons
// qui font avancer la demande, pas celui de l'état courant.
const NEXT_STATUSES: Record<string, { status: string; label: string }[]> = {
  nouveau: [
    { status: "en_cours", label: "Prendre en charge" },
    { status: "traite", label: "Clore" },
  ],
  en_cours: [{ status: "traite", label: "Clore" }],
  traite: [{ status: "en_cours", label: "Réouvrir" }],
};

export default async function SiteInboxPage() {
  await requireRole("PM", "DIR");
  const { contactRequests, subscribers, pageViews, topContent } =
    await apiGet<SiteInboxScreen>("/api/admin/site/inbox");

  const open = contactRequests.filter((r) => r.status !== "traite");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Retours du site</h1>
        <p className="mt-1 text-sm text-muted">
          {open.length} demande{open.length > 1 ? "s" : ""} à traiter · {subscribers.length} abonné
          {subscribers.length > 1 ? "s" : ""} à la newsletter
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Demandes de contact" value={String(contactRequests.length)} note={`${open.length} à traiter`} />
        <Kpi label="Abonnés newsletter" value={String(subscribers.length)} note="inscrits depuis le blog" />
        <Kpi label="Visites du portfolio" value={String(pageViews.portfolio)} note="cumul depuis la mise en ligne" />
        <Kpi label="Visites du blog" value={String(pageViews.blog)} note="cumul depuis la mise en ligne" />
      </div>

      <div className="rounded-xl border border-border bg-panel">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-text">Demandes de contact</h2>
        </div>
        {contactRequests.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Aucune demande reçue.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {contactRequests.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 px-5 py-4 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-text">
                      {r.name}
                      {r.company ? <span className="text-muted"> · {r.company}</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      <a href={`mailto:${r.email}`} className="hover:text-mint">
                        {r.email}
                      </a>
                      {r.phone ? ` · ${r.phone}` : ""} · {fmtDateTime(r.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CONTACT_STATUS_CLASS[r.status] ?? "bg-white/5 text-muted"}`}
                  >
                    {CONTACT_STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>

                {r.project || r.budget ? (
                  <p className="text-xs text-muted">
                    {r.project ? `projet : ${r.project}` : ""}
                    {r.project && r.budget ? " · " : ""}
                    {r.budget ? `budget : ${r.budget}` : ""}
                  </p>
                ) : null}

                {r.message ? (
                  <p className="whitespace-pre-wrap rounded-lg border border-border bg-panel-2 px-3 py-2 text-text">
                    {r.message}
                  </p>
                ) : null}

                <div className="flex items-center gap-2">
                  {(NEXT_STATUSES[r.status] ?? []).map((t) => (
                    <form key={t.status} action={setContactStatusAction.bind(null, r.id, t.status)}>
                      <button
                        type="submit"
                        className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text"
                      >
                        {t.label}
                      </button>
                    </form>
                  ))}
                  <form action={deleteContactAction.bind(null, r.id)}>
                    <button
                      type="submit"
                      className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-red/50 hover:text-red"
                    >
                      Supprimer
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-panel">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-text">Abonnés à la newsletter</h2>
          </div>
          {subscribers.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">Aucun abonné.</p>
          ) : (
            <div className="flex max-h-96 flex-col divide-y divide-border overflow-y-auto">
              {subscribers.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-text">{s.email}</p>
                    <p className="text-xs text-muted">{fmtDateTime(s.createdAt)}</p>
                  </div>
                  <form action={deleteSubscriberAction.bind(null, s.id)}>
                    <button
                      type="submit"
                      className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-red/50 hover:text-red"
                    >
                      Désinscrire
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-panel">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-text">Contenus les plus consultés</h2>
          </div>
          {topContent.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">Aucune consultation enregistrée.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {topContent.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-text">{c.title}</p>
                    <p className="text-xs text-muted">{c.type}</p>
                  </div>
                  <span className="shrink-0 text-muted">{c.views} vues</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
