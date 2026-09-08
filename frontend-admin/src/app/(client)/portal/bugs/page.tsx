import Link from "next/link";
import { apiGet } from "@/lib/api";
import { requireClientProject } from "@/lib/client-project";
import { fmtHours, SEVERITY_LABEL, TICKET_TYPE_CLIENT_LABEL } from "@/lib/format";
import { TRIAGE_STATE_LABEL, TRIAGE_STATE_BADGE_CLASS } from "@/lib/format";
import { createClientTicketAction } from "../actions";
import type { PortalBugsScreen } from "../types";

const FILTERS = [
  { id: "all", label: "Tous" },
  { id: "BUG", label: "Bugs" },
  { id: "DEV", label: "Demandes d’ajout" },
  { id: "open", label: "Ouverts" },
  { id: "closed", label: "Résolus" },
];

export default async function PortalBugsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { project } = await requireClientProject();
  const sp = await searchParams;
  const filter = sp.filter ?? "all";

  const { tickets } = await apiGet<PortalBugsScreen>("/api/admin/client/bugs", "/portal");
  const filtered = tickets.filter((t) => {
    if (filter === "BUG") return t.type === "BUG";
    if (filter === "DEV") return t.type === "DEV";
    if (filter === "open") return t.triageState !== "CLOS";
    if (filter === "closed") return t.triageState === "CLOS";
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Signalements</h1>
        <p className="mt-1 text-sm text-muted">{project.name} · espace client</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "all" ? "/portal/bugs" : `/portal/bugs?filter=${f.id}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === f.id ? "border-mint/40 bg-mint/10 text-text" : "border-border text-muted hover:text-text"
            }`}
          >
            {f.label} · {tickets.filter((t) => {
              if (f.id === "BUG") return t.type === "BUG";
              if (f.id === "DEV") return t.type === "DEV";
              if (f.id === "open") return t.triageState !== "CLOS";
              if (f.id === "closed") return t.triageState === "CLOS";
              return true;
            }).length}
          </Link>
        ))}
      </div>

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-panel">
        {filtered.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Aucun signalement pour ce filtre.</p>
        ) : (
          filtered.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <div className="min-w-0">
                <p className="text-text">{t.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {TICKET_TYPE_CLIENT_LABEL[t.type]}{t.severity ? ` · ${SEVERITY_LABEL[t.severity]}` : ""} · {fmtHours(t.estHours)}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TRIAGE_STATE_BADGE_CLASS[t.triageState]}`}>
                {TRIAGE_STATE_LABEL[t.triageState]}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Nouveau signalement</h2>
        <ClientTicketForm />
      </div>
    </div>
  );
}

function ClientTicketForm() {
  return (
    <form action={createClientTicketAction} className="mt-3 flex flex-col gap-3">
      <div className="flex gap-2">
        <label className="flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-center text-sm has-[:checked]:border-mint/40 has-[:checked]:bg-mint/10 has-[:checked]:text-text text-muted">
          <input type="radio" name="type" value="BUG" defaultChecked className="sr-only" /> Bug
        </label>
        <label className="flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-center text-sm has-[:checked]:border-mint/40 has-[:checked]:bg-mint/10 has-[:checked]:text-text text-muted">
          <input type="radio" name="type" value="DEV" className="sr-only" /> Demande d’ajout
        </label>
      </div>
      <input name="title" required placeholder="Titre" className="input" />
      <textarea name="description" required rows={3} placeholder="Décrivez le comportement observé ou la fonctionnalité souhaitée…" className="input" />
      <select name="severity" className="input">
        <option value="MINEUR">Gêne mineure</option>
        <option value="MAJEUR">Gêne majeure</option>
        <option value="BLOQUANT">Bloquant</option>
      </select>
      <button type="submit" className="self-start rounded-lg bg-mint px-4 py-2 text-sm font-semibold text-bg">Envoyer</button>
    </form>
  );
}
