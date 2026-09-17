import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { ScreenTabs } from "./screen-tabs";
import type { FinanceScreen } from "./types";
import { fmtHours, fmtEUR, fmtDate, pctOf, currentPeriodLabel, INVOICE_STATUS_BADGE_CLASS, INVOICE_STATUS_LABEL } from "@/lib/format";
import { createInvoiceAction, markInvoicePaidAction, updateInvoiceAction, deleteInvoiceAction } from "./actions";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireRole("PM", "DIR");
  // Refus de l'API — une facture payée, par exemple — remonté dans l'URL.
  const { error } = await searchParams;

  const { invoices, activeProjects, projects } = await apiGet<FinanceScreen>("/api/admin/finance");

  const billed = invoices.reduce((s, i) => s + i.amount, 0);
  const collected = invoices.filter((i) => i.status === "PAYEE").reduce((s, i) => s + i.amount, 0);
  const late = invoices.filter((i) => i.status === "EN_RETARD").reduce((s, i) => s + i.amount, 0);
  // Seuls les projets chiffrés entrent dans la moyenne : un projet sans montant
  // vendu n'a pas de marge nulle, il n'en a pas.
  const priced = activeProjects.filter((p) => p.soldAmount);
  const avgMargin = priced.length
    ? Math.round(
        priced.reduce((s, p) => s + pctOf(p.soldAmount! - (p.costAmount ?? 0), p.soldAmount), 0) / priced.length
      )
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Facturation &amp; rentabilité</h1>
          <p className="mt-1 text-sm text-muted">{currentPeriodLabel()}</p>
        </div>
        <ScreenTabs active="/finance" role={user.role} />
      </div>

      {error ? (
        <p className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">{error}</p>
      ) : null}

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Facturé" value={fmtEUR(billed)} note={`${invoices.length} factures`} />
        <Kpi label="Encaissé" value={fmtEUR(collected)} note={billed ? `${pctOf(collected, billed)}% du facturé` : "—"} color="text-mint" />
        <Kpi label="En retard" value={fmtEUR(late)} note={`${invoices.filter((i) => i.status === "EN_RETARD").length} factures`} color="text-amber" />
        <Kpi label="Marge moyenne" value={`${avgMargin >= 0 ? "+" : ""}${avgMargin} %`} note="projets actifs" color="text-mint" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-panel">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead><tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-4 py-3 font-medium">Projet</th><th className="px-4 py-3 font-medium">Vendu</th>
            <th className="px-4 py-3 font-medium">Coût</th><th className="px-4 py-3 font-medium">Heures</th>
            <th className="px-4 py-3 font-medium">Taux</th><th className="px-4 py-3 font-medium">Marge</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {activeProjects.map((p) => {
              const margin = pctOf((p.soldAmount ?? 0) - (p.costAmount ?? 0), p.soldAmount);
              const rate = p.hoursSpent ? Math.round((p.soldAmount ?? 0) / p.hoursSpent) : 0;
              return (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-text">{p.client.name} — {p.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtEUR(p.soldAmount)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtEUR(p.costAmount)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtHours(p.hoursSpent)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtEUR(rate)}/h</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={margin >= 0 ? "font-medium text-mint" : "font-medium text-red"}>
                      {margin >= 0 ? "+" : ""}{margin}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Factures</h2>
        </div>
        <div className="mt-3 flex flex-col divide-y divide-border">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex flex-col gap-2 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-text">{inv.ref} · {inv.label}</p>
                  <p className="text-xs text-muted">
                    {inv.status === "PAYEE" ? `payée ${fmtDate(inv.paidAt)}` : inv.dueAt ? `échue ${fmtDate(inv.dueAt)}` : `émise ${fmtDate(inv.issuedAt)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-medium text-text">{fmtEUR(inv.amount)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_BADGE_CLASS[inv.status]}`}>
                    {INVOICE_STATUS_LABEL[inv.status]}
                  </span>
                  {inv.status !== "PAYEE" ? (
                    <form action={markInvoicePaidAction.bind(null, inv.id)}>
                      <button type="submit" className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text">Marquer payée</button>
                    </form>
                  ) : null}
                </div>
              </div>
              {/* Une facture payée est une pièce comptable : on la rectifie par
                  un avoir, pas en réécrivant son montant. Tant qu'elle ne l'est
                  pas, elle se corrige et se supprime. */}
              {inv.status !== "PAYEE" ? (
                <details>
                  <summary className="cursor-pointer text-xs text-muted hover:text-text">Modifier</summary>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <form action={updateInvoiceAction} className="flex flex-1 flex-wrap items-center gap-2">
                      <input type="hidden" name="invoiceId" value={inv.id} />
                      <input name="label" defaultValue={inv.label} className="input flex-1" />
                      <input name="amount" defaultValue={inv.amount} className="input w-32" />
                      <input
                        name="dueAt"
                        type="date"
                        defaultValue={inv.dueAt ? new Date(inv.dueAt).toISOString().slice(0, 10) : ""}
                        className="input w-40"
                      />
                      <button type="submit" className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text">
                        Enregistrer
                      </button>
                    </form>
                    <form action={deleteInvoiceAction.bind(null, inv.id)}>
                      <button type="submit" className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-red/50 hover:text-red">
                        Supprimer
                      </button>
                    </form>
                  </div>
                </details>
              ) : null}
            </div>
          ))}
        </div>
        <details className="mt-4"><summary className="cursor-pointer text-xs font-medium text-mint">+ Créer une facture</summary>
          <form action={createInvoiceAction} className="mt-2 grid grid-cols-4 gap-2">
            <select name="projectId" className="input" required>
              <option value="">Projet</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.client.name} — {p.name}</option>)}
            </select>
            <input name="label" placeholder="Libellé (ex : jalon 3)" className="input" required />
            <input name="amount" placeholder="Montant €" className="input" required />
            <input name="dueAt" type="date" className="input" />
            <button type="submit" className="col-span-4 rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">Créer la facture</button>
          </form>
        </details>
      </div>
    </div>
  );
}

function Kpi({ label, value, note, color }: { label: string; value: string; note: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${color ?? "text-text"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
