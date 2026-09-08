import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import type { FinanceScreen } from "./types";
import { fmtHours, fmtEUR, fmtDate, currentPeriodLabel, INVOICE_STATUS_BADGE_CLASS, INVOICE_STATUS_LABEL } from "@/lib/format";
import { createInvoiceAction, markInvoicePaidAction } from "./actions";

export default async function FinancePage() {
  await requireRole("PM", "DIR");

  const { invoices, activeProjects, projects } = await apiGet<FinanceScreen>("/api/admin/finance");

  const billed = invoices.reduce((s, i) => s + i.amount, 0);
  const collected = invoices.filter((i) => i.status === "PAYEE").reduce((s, i) => s + i.amount, 0);
  const late = invoices.filter((i) => i.status === "EN_RETARD").reduce((s, i) => s + i.amount, 0);
  const avgMargin = activeProjects.length
    ? Math.round(
        activeProjects.reduce((s, p) => s + ((p.soldAmount! - p.costAmount!) / p.soldAmount!) * 100, 0) / activeProjects.length
      )
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Facturation &amp; rentabilité</h1>
          <p className="mt-1 text-sm text-muted">{currentPeriodLabel()}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Facturé" value={fmtEUR(billed)} note={`${invoices.length} factures`} />
        <Kpi label="Encaissé" value={fmtEUR(collected)} note={billed ? `${Math.round((collected / billed) * 100)}% du facturé` : "—"} color="text-mint" />
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
              const margin = Math.round(((p.soldAmount! - p.costAmount!) / p.soldAmount!) * 100);
              const rate = p.hoursSpent ? Math.round(p.soldAmount! / p.hoursSpent) : 0;
              return (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-text">{p.client.name} — {p.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtEUR(p.soldAmount!)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtEUR(p.costAmount!)}</td>
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
            <div key={inv.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
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
