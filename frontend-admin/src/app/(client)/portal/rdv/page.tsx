import { apiGet } from "@/lib/api";
import { requireClientProject } from "@/lib/client-project";
import { fmtDateTime } from "@/lib/format";
import { CalendlyEmbed } from "@/components/calendly-embed";
import type { PortalRdvScreen } from "../types";

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL;

export default async function PortalRdvPage() {
  // Le périmètre projet est déduit de la session côté API.
  await requireClientProject();

  const { next, past, host } = await apiGet<PortalRdvScreen>("/api/admin/client/rdv", "/portal");

  const agenda: { label: string; detail: string; from: string }[] = next ? JSON.parse(next.agenda) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Point hebdomadaire</h1>
        <p className="mt-1 text-sm text-muted">{host?.name ? `avec ${host.name}` : ""}</p>
      </div>

      {next ? (
        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold text-text">Prochain rendez-vous</h2>
          <p className="mt-1 text-sm text-text">{fmtDateTime(next.whenAt)}</p>
          <p className="text-xs text-muted">{next.whereLabel} · {next.cadence}</p>
          {agenda.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2">
              {agenda.map((a, i) => (
                <div key={i} className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
                  <p className="text-text">{a.label}</p>
                  <p className="text-xs text-muted">{a.detail} · {a.from}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-panel px-5 py-6 text-sm text-muted">Aucun rendez-vous programmé.</p>
      )}

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Réserver un créneau</h2>
        <p className="mt-1 text-xs text-muted">Calendly · 30 min avec {host?.name ?? "votre cheffe de projet"}</p>
        {CALENDLY_URL ? (
          <div className="mt-3">
            <CalendlyEmbed url={CALENDLY_URL} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Aucun lien Calendly configuré.</p>
        )}
      </div>

      {past.length > 0 ? (
        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold text-text">Comptes rendus précédents</h2>
          <div className="mt-3 flex flex-col gap-2">
            {past.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
                <p className="text-text">{fmtDateTime(p.whenAt)}</p>
                <p className="mt-0.5 text-xs text-muted">{p.summary}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
