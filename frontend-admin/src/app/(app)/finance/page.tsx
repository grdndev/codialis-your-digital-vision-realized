import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { ScreenTabs } from "./screen-tabs";
import type { BillingRow, FinanceScreen, InvoiceRow } from "./types";
import { InvoiceForm } from "./invoice-form";
import { Popover } from "../popover";
import { fmtHours, fmtEUR, fmtDate, pctOf, currentPeriodLabel, INVOICE_STATUS_BADGE_CLASS, INVOICE_STATUS_LABEL, projectLabel, authorName, authorInitials } from "@/lib/format";
import { addInvoiceCommentAction, markInvoicePaidAction, setInvoiceStatusAction, updateInvoiceAction, deleteInvoiceAction, updateProjectBillingAction, setInvoiceMilestoneAction, updateRatesAction } from "./actions";
import type { ProjectWithClient } from "@/lib/dto";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireRole("PM", "DIR");
  // Refus de l'API — une facture payée, par exemple — remonté dans l'URL.
  const { error } = await searchParams;

  const { invoices, activeProjects, projects, billing, planPresets, rates } = await apiGet<FinanceScreen>("/api/admin/finance");
  const billingByProject = new Map(billing.map((b) => [b.projectId, b]));

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
                  <td className="whitespace-nowrap px-4 py-3 text-text">{projectLabel(p.client.name, p.name)}</td>
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

      <AgencyRates rates={rates} />

      <BillingPlans projects={projects} billingByProject={billingByProject} planPresets={planPresets} />

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
                  {/* Le projet n'apparaissait que si le libellé le nommait. */}
                  <p className="text-xs text-muted">
                    {projectLabel(inv.project.client.name, inv.project.name)} ·{" "}
                    {inv.status === "PAYEE" ? `payée ${fmtDate(inv.paidAt)}` : inv.dueAt ? `échue ${fmtDate(inv.dueAt)}` : `émise ${fmtDate(inv.issuedAt)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-medium text-text">{fmtEUR(inv.amount)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_BADGE_CLASS[inv.status]}`}>
                    {INVOICE_STATUS_LABEL[inv.status]}
                  </span>
                  {inv.status === "EN_ATTENTE" ? (
                    <form action={setInvoiceStatusAction.bind(null, inv.id, "EN_RETARD")}>
                      <button type="submit" className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-amber/50 hover:text-amber">Marquer en retard</button>
                    </form>
                  ) : null}
                  {inv.status === "EN_RETARD" ? (
                    <form action={setInvoiceStatusAction.bind(null, inv.id, "EN_ATTENTE")}>
                      <button type="submit" className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text">Remettre en attente</button>
                    </form>
                  ) : null}
                  {inv.status !== "PAYEE" ? (
                    <form action={markInvoicePaidAction.bind(null, inv.id)}>
                      <button type="submit" className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text">Marquer payée</button>
                    </form>
                  ) : null}
                  <DeleteInvoice invoice={inv} />
                </div>
              </div>
              {/* Le montant d'une facture payée ne se réécrit plus ; tant qu'elle
                  ne l'est pas, elle se corrige. La suppression, elle, est sur la
                  ligne, pour toutes. */}
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
                  </div>
                </details>
              ) : null}
              <InvoiceMilestone invoice={inv} billing={billingByProject.get(inv.projectId)} />
              <InvoiceHistory invoice={inv} />
            </div>
          ))}
        </div>
        <details className="mt-4"><summary className="cursor-pointer text-xs font-medium text-mint">+ Créer une facture</summary>
          <InvoiceForm
            projects={projects.map((p) => ({ id: p.id, label: projectLabel(p.client.name, p.name) }))}
            nextByProject={Object.fromEntries(billing.map((b) => [b.projectId, b.next]))}
          />
        </details>
      </div>
    </div>
  );
}

const planLabel = (plan: string) => plan.split(",").join(" / ");

// Taux de l'agence (CC-357). On règle le taux horaire et la durée d'une
// journée ; le taux journalier s'en déduit, et les heures vendues de chaque
// projet se calculent sur son montant vendu. Changer le taux ne réécrit pas
// les projets déjà vendus : il vaut pour les prix saisis ensuite.
function AgencyRates({ rates }: { rates: { hourlyRate: number; workdayHours: number } }) {
  const frenchNumber = (n: number) => String(n).replace(".", ",");
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <h2 className="text-sm font-semibold text-text">Taux de l’agence</h2>
      <p className="mt-1 text-xs text-muted">
        Soit {fmtEUR(rates.hourlyRate * rates.workdayHours)} la journée. Les heures vendues
        d’un projet se calculent sur son montant vendu, au moment où il est saisi : changer
        le taux ne réécrit pas les projets déjà vendus.
      </p>
      <form action={updateRatesAction} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Taux horaire (€/h)
          <input name="hourlyRate" defaultValue={frenchNumber(rates.hourlyRate)} className="input w-32" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Durée d’une journée (h)
          <input name="workdayHours" defaultValue={frenchNumber(rates.workdayHours)} className="input w-32" />
        </label>
        <button type="submit" className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:text-text">
          Enregistrer
        </button>
      </form>
    </div>
  );
}

// Échéancier de chaque projet ouvert (CC-350) : son prix total, son découpage
// en pourcentages, ce qui en est déjà facturé et l'échéance qui vient. Le prix
// est le « montant vendu » de la fiche projet : le changer ici le change
// là-bas, et inversement.
function BillingPlans({
  projects,
  billingByProject,
  planPresets,
}: {
  projects: ProjectWithClient[];
  billingByProject: Map<string, BillingRow>;
  planPresets: string[];
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <h2 className="text-sm font-semibold text-text">Échéancier des projets</h2>
      <p className="mt-1 text-xs text-muted">
        Prix total et découpage de la facturation. « Créer une facture » propose ensuite
        l’échéance suivante toute calculée ; le solde reprend ce qui reste réellement à
        facturer, arrondis et changements de prix compris.
      </p>
      <div className="mt-3 flex flex-col divide-y divide-border text-sm">
        {projects.map((p) => {
          const b = billingByProject.get(p.id);
          if (!b) return null;
          const options = planPresets.includes(b.plan) ? planPresets : [b.plan, ...planPresets];
          const remaining = b.total ? b.total - b.planInvoiced : null;
          return (
            <form key={p.id} action={updateProjectBillingAction} className="grid grid-cols-12 items-center gap-3 py-2.5">
              <input type="hidden" name="projectId" value={p.id} />
              <span className="col-span-3 truncate text-text">{projectLabel(p.client.name, p.name)}</span>
              <label className="col-span-2 flex items-center gap-1.5 text-xs text-muted">
                <input name="total" defaultValue={b.total ?? ""} placeholder="Prix total €" className="input text-xs" aria-label="Prix total" />
              </label>
              <select name="plan" defaultValue={b.plan} className="input col-span-2 text-xs" aria-label="Échéancier">
                {options.map((o) => (
                  <option key={o} value={o}>
                    {planLabel(o)}
                  </option>
                ))}
              </select>
              <span className="col-span-2 text-xs text-muted">
                {b.total ? `${fmtHours(p.hoursSold)} vendues · ` : ""}
                facturé {fmtEUR(b.planInvoiced)}
                {remaining !== null ? ` · reste ${fmtEUR(remaining)}` : ""}
                {b.extraInvoiced ? ` · + ${fmtEUR(b.extraInvoiced)} hors échéancier` : ""}
              </span>
              <span className="col-span-2 text-xs">
                {b.next.status === "next" ? (
                  <span className="text-mint">
                    à venir : {b.next.label} · {fmtEUR(b.next.amount)}
                  </span>
                ) : b.next.status === "done" ? (
                  <span className="text-muted">échéancier soldé</span>
                ) : (
                  <span className="text-amber">prix total à renseigner</span>
                )}
              </span>
              <button type="submit" className="col-span-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text">
                Enregistrer
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}

// Suppression en deux temps : le bouton de la ligne ouvre la confirmation, sans
// JavaScript. Une facture payée le dit, puisqu'elle sort alors de l'encaissé.
function DeleteInvoice({ invoice }: { invoice: InvoiceRow }) {
  return (
    <Popover
      summary="Supprimer"
      summaryClassName="cursor-pointer list-none rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-red/50 hover:text-red"
    >
      <form
        action={deleteInvoiceAction.bind(null, invoice.id)}
        className="absolute right-0 z-10 mt-2 flex w-72 flex-col gap-2 rounded-xl border border-border bg-panel p-3 text-xs shadow-2xl"
      >
        <p className="text-text">Supprimer {invoice.ref} ({fmtEUR(invoice.amount)}) ?</p>
        {invoice.status === "PAYEE" ? (
          <p className="text-amber">Elle est marquée payée : son montant sortira aussi de l’encaissé.</p>
        ) : null}
        <p className="text-muted">Son historique part avec elle. C’est définitif.</p>
        <button type="submit" className="rounded-lg bg-red/90 px-3 py-1.5 font-semibold text-bg hover:bg-red">
          Confirmer la suppression
        </button>
      </form>
    </Popover>
  );
}

// L'échéance qu'une facture règle. Les factures émises avant l'échéancier
// n'en ont pas : sans ce rattachement, un projet déjà facturé à mi-parcours
// se verrait proposer son acompte. Un projet clôturé n'a plus d'échéancier.
function InvoiceMilestone({ invoice, billing }: { invoice: InvoiceRow; billing: BillingRow | undefined }) {
  if (!billing) return null;
  const current = billing.steps.find((s) => s.index === invoice.milestone);
  return (
    <details>
      <summary className="cursor-pointer text-xs text-muted hover:text-text">
        Échéance : {current ? `${current.name} (${current.pct} %)` : "hors échéancier"}
      </summary>
      <form action={setInvoiceMilestoneAction.bind(null, invoice.id)} className="mt-2 flex items-center gap-2">
        <select name="milestone" defaultValue={invoice.milestone ?? ""} className="input w-56 text-xs">
          <option value="">Hors échéancier</option>
          {billing.steps.map((s) => (
            <option key={s.index} value={s.index}>
              {s.name} ({s.pct} %)
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text">
          Rattacher
        </button>
      </form>
    </details>
  );
}

// Historique d'une facture (CC-349) : relances, promesses de paiement,
// échanges avec le client. Ouvert aussi sur une facture payée.
function InvoiceHistory({ invoice }: { invoice: InvoiceRow }) {
  return (
    <details>
      <summary className="cursor-pointer text-xs text-muted hover:text-text">
        Historique ({invoice.comments.length})
      </summary>
      <div className="mt-2 flex flex-col gap-2.5">
        {invoice.comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint/15 text-[10px] font-medium text-mint">
              {authorInitials(c.author)}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted">
                <span className="font-medium text-text">{authorName(c.author)}</span> · {fmtDate(c.createdAt)}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-text">{c.body}</p>
            </div>
          </div>
        ))}
        <form action={addInvoiceCommentAction.bind(null, invoice.id)} className="flex items-end gap-2">
          <textarea
            name="body"
            required
            rows={2}
            placeholder="Ajouter un commentaire…"
            className="field-sizing-content min-h-16 max-h-60 flex-1 resize-y rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text"
          />
          <button type="submit" className="rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">
            Envoyer
          </button>
        </form>
      </div>
    </details>
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
