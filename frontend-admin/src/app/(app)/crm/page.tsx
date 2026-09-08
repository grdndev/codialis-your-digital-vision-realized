import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import type { CrmScreen, DealRow } from "./types";
import { fmtEUR, fmtDate, DEAL_STAGE_LABEL } from "@/lib/format";
import { PipelineBoard, type BoardColumn } from "./pipeline-board";
import { updateDealAction, setLossReasonAction, addDealNoteAction, createDealAction, updateQuarterlyTargetAction, importDealsCsvAction } from "./actions";
import type { DealStage } from "@/lib/types";

const STAGES: DealStage[] = ["CONTACT", "QUALIFIE", "DEVIS", "NEGOCIATION", "SIGNE", "REFUSE"];
const LOSS_REASONS = ["Prix", "Concurrent", "Projet reporté", "Sans réponse", "Hors périmètre", "Budget annulé"];
const IMPORT_ERROR_LABEL: Record<string, string> = {
  empty: "Fichier vide ou illisible.",
  header: "Colonne « nom » introuvable dans l’en-tête du CSV.",
};

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ deal?: string; imported?: string; skipped?: string; importError?: string }>;
}) {
  await requireRole("PM", "DIR");
  const sp = await searchParams;

  const { deals, quarterlyTarget } = await apiGet<CrmScreen>("/api/admin/crm");

  const signed = deals.filter((d) => d.stage === "SIGNE");
  const refused = deals.filter((d) => d.stage === "REFUSE");
  const open = deals.filter((d) => !["SIGNE", "REFUSE"].includes(d.stage));
  const signedTotal = signed.reduce((s, d) => s + d.amount, 0);
  const weighted = open.reduce((s, d) => s + (d.amount * d.probabilityPct) / 100, 0);
  const closingRate = signed.length + refused.length ? Math.round((signed.length / (signed.length + refused.length)) * 100) : 0;
  const avgBasket = signed.length ? Math.round(signedTotal / signed.length) : 0;
  const progressPct = Math.min(100, Math.round((signedTotal / quarterlyTarget) * 100));
  const inSigningPct = Math.min(100 - progressPct, Math.round((weighted / quarterlyTarget) * 100));

  const columns: BoardColumn[] = STAGES.map((stage) => ({
    stage,
    deals: deals.filter((d) => d.stage === stage).map((d) => ({
      id: d.id, name: d.name, amount: d.amount, note: d.note, nextAction: d.nextAction,
      probabilityPct: d.probabilityPct, lossReason: d.lossReason, noteCount: d.notes.length,
    })),
  }));

  const selected = sp.deal ? deals.find((d) => d.id === sp.deal) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Prospection commerciale</h1>
          <p className="mt-1 text-sm text-muted">Pipe {fmtEUR(weighted + signedTotal)} · objectif T3</p>
        </div>
        <div className="flex gap-2">
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text">+ Importer un CSV</summary>
            <form action={importDealsCsvAction} encType="multipart/form-data" className="absolute right-0 z-10 mt-2 flex w-72 flex-col gap-2 rounded-xl border border-border bg-panel p-4 shadow-2xl">
              <p className="text-xs text-muted">
                Colonnes attendues : <span className="text-text">nom</span> (obligatoire), montant (k€), note, email, telephone, source.
              </p>
              <input name="file" type="file" accept=".csv,text/csv" required className="input" />
              <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text">Importer</button>
            </form>
          </details>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">+ Nouveau prospect</summary>
            <form action={createDealAction} className="absolute right-0 z-10 mt-2 flex w-64 flex-col gap-2 rounded-xl border border-border bg-panel p-4 shadow-2xl">
              <input name="name" placeholder="Nom de l’entreprise" required className="input" />
              <input name="note" placeholder="Description courte" className="input" />
              <input name="amount" placeholder="Montant estimé (k€)" className="input" />
              <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Créer</button>
            </form>
          </details>
        </div>
      </div>

      {sp.imported !== undefined ? (
        <div className="rounded-xl border border-mint/30 bg-mint/5 px-4 py-3 text-sm text-text">
          {sp.imported} prospect{Number(sp.imported) > 1 ? "s" : ""} importé{Number(sp.imported) > 1 ? "s" : ""}
          {sp.skipped && Number(sp.skipped) > 0 ? ` · ${sp.skipped} ligne${Number(sp.skipped) > 1 ? "s" : ""} ignorée${Number(sp.skipped) > 1 ? "s" : ""} (nom manquant)` : ""}.
        </div>
      ) : null}
      {sp.importError ? (
        <div className="rounded-xl border border-red/30 bg-red/5 px-4 py-3 text-sm text-red">
          Import impossible : {IMPORT_ERROR_LABEL[sp.importError] ?? sp.importError}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-panel p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Objectif du trimestre</span>
          <span className="text-text">{fmtEUR(signedTotal)} signés sur {fmtEUR(quarterlyTarget)}</span>
        </div>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-mint" style={{ width: `${progressPct}%` }} />
          <div className="h-full bg-amber/60" style={{ width: `${inSigningPct}%` }} />
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-mint">Modifier l’objectif</summary>
          <form action={updateQuarterlyTargetAction} className="mt-2 flex items-center gap-2">
            <input
              name="quarterlyTarget"
              type="number"
              min="1"
              step="1000"
              defaultValue={quarterlyTarget}
              className="input w-40"
            />
            <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs text-text">Enregistrer</button>
          </form>
        </details>
        <div className="mt-4 grid grid-cols-4 gap-4">
          <Stat label="Signé" value={fmtEUR(signedTotal)} />
          <Stat label="Pipe pondéré" value={fmtEUR(weighted)} />
          <Stat label="Taux de closing" value={`${closingRate}%`} />
          <Stat label="Panier moyen" value={fmtEUR(avgBasket)} />
        </div>
      </div>

      <PipelineBoard columns={columns} selectedId={selected?.id} />

      {selected ? <DealDetail deal={selected} /> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-base font-semibold text-text">{value}</p>
    </div>
  );
}

function DealDetail({ deal: d }: { deal: DealRow }) {
  const isLost = d.stage === "REFUSE";
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">{d.name}</h2>
        <span className="text-xs text-muted">{DEAL_STAGE_LABEL[d.stage]}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <form action={updateDealAction} className="flex flex-col gap-2">
          <input type="hidden" name="dealId" value={d.id} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Prénom"><input name="contactFirst" defaultValue={d.contactFirst ?? ""} className="input" /></Field>
            <Field label="Nom"><input name="contactLast" defaultValue={d.contactLast ?? ""} className="input" /></Field>
          </div>
          <Field label="E-mail"><input name="contactEmail" defaultValue={d.contactEmail ?? ""} className="input" /></Field>
          <Field label="Téléphone"><input name="contactPhone" defaultValue={d.contactPhone ?? ""} className="input" /></Field>
          <Field label="Source"><span className="text-sm text-muted">{d.source ?? "—"}</span></Field>
          <Field label="Description"><textarea name="description" defaultValue={d.description} rows={2} className="input" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Temps de dev estimé (h)"><input name="devHours" defaultValue={d.devHours ?? ""} className="input" /></Field>
            <Field label="Taux horaire (€)"><input name="hourlyRate" defaultValue={d.hourlyRate ?? ""} className="input" /></Field>
          </div>
          <button type="submit" className="mt-1 rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Enregistrer</button>
        </form>

        <div className="flex flex-col gap-4">
          {isLost ? (
            <form action={setLossReasonAction} className="flex flex-col gap-2 rounded-lg border border-red/30 bg-red/5 p-3">
              <input type="hidden" name="dealId" value={d.id} />
              <p className="text-xs font-medium text-red">Motif de refus</p>
              <select name="lossReason" defaultValue={d.lossReason ?? ""} className="input">
                <option value="">Choisir</option>
                {LOSS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <textarea name="lossDetail" defaultValue={d.lossDetail ?? ""} placeholder="Précisions" rows={2} className="input" />
              <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs text-text">Enregistrer le motif</button>
              {d.lostAt ? <p className="text-xs text-muted">perdu le {fmtDate(d.lostAt)}{d.lostBy ? ` · qualifié par ${d.lostBy}` : ""}</p> : null}
            </form>
          ) : null}

          <div>
            <p className="text-xs font-medium text-muted">Notes de suivi</p>
            <div className="mt-2 flex flex-col gap-2">
              {d.notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
                  <p className="text-xs text-muted">{n.author.name} · {fmtDate(n.createdAt)}</p>
                  <p className="mt-0.5 text-text">{n.body}</p>
                </div>
              ))}
              {d.notes.length === 0 ? <p className="text-sm text-muted">Aucune note.</p> : null}
            </div>
            <form action={addDealNoteAction} className="mt-2 flex gap-2">
              <input type="hidden" name="dealId" value={d.id} />
              <input name="body" required placeholder="Ajouter une note…" className="input" />
              <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Ajouter</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}
