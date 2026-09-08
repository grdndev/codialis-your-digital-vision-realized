import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import type { PilotageScreen } from "./types";
import { fmtHours, fmtEUR, fmtDate, currentMonthBounds, monthProgressFraction } from "@/lib/format";
import { addDecisionAction, updateMonthlyChargesAction, updateMonthlyRevenueTargetAction } from "./actions";

const CONCENTRATION_ALERT_PCT = 25;

export default async function PilotagePage() {
  await requireRole("DIR");
  const { start: monthStart, end: monthEnd } = currentMonthBounds();

  // Les bornes du mois partent d'ici : le libellé affiché et les chiffres
  // renvoyés doivent décrire la même période.
  const query = new URLSearchParams({
    monthStart: monthStart.toISOString(),
    monthEnd: monthEnd.toISOString(),
  });
  const {
    cashItems,
    teamProfit,
    projects,
    deals,
    decisions,
    monthlyCharges,
    monthlyRevenueTarget,
    paidThisMonth,
    overdueInvoices,
  } = await apiGet<PilotageScreen>(`/api/admin/pilotage?${query}`);

  const revenueThisMonth = paidThisMonth.reduce((s, i) => s + i.amount, 0);
  const revenuePct = Math.min(100, Math.round((revenueThisMonth / monthlyRevenueTarget) * 100));
  const pace = monthProgressFraction();
  const expectedByNow = monthlyRevenueTarget * pace;
  const behindPace = revenueThisMonth < expectedByNow * 0.9;

  const inClosing = deals.filter((d) => d.stage === "DEVIS" || d.stage === "NEGOCIATION");
  const overdueTotal = overdueInvoices.reduce((s, i) => s + i.amount, 0);
  const inClosingTotal = inClosing.reduce((s, d) => s + (d.amount * d.probabilityPct) / 100, 0);
  const prospecting = deals.filter((d) => d.stage === "CONTACT" || d.stage === "QUALIFIE");

  const suggestions: { text: string; href: string; cta: string }[] = [];
  if (overdueInvoices.length > 0) {
    suggestions.push({
      text: `${overdueInvoices.length} facture${overdueInvoices.length > 1 ? "s" : ""} en retard, ${fmtEUR(overdueTotal)} en attente d’encaissement.`,
      href: "/automations",
      cta: "Relancer",
    });
  }
  if (inClosing.length > 0) {
    suggestions.push({
      text: `${inClosing.length} devis en cours de négociation, ${fmtEUR(inClosingTotal)} pondérés qui pourraient se signer ce mois-ci.`,
      href: "/crm",
      cta: "Voir le pipe",
    });
  }
  if (prospecting.length > 0) {
    suggestions.push({
      text: `${prospecting.length} prospect${prospecting.length > 1 ? "s" : ""} encore en Contact/Qualifié à faire avancer.`,
      href: "/crm",
      cta: "Voir le pipe",
    });
  }

  const months = [...new Set(cashItems.map((c) => c.monthLabel))];

  const byClient = new Map<string, number>();
  for (const p of projects) byClient.set(p.client.name, (byClient.get(p.client.name) ?? 0) + (p.soldAmount ?? 0));
  const totalSold = [...byClient.values()].reduce((s, v) => s + v, 0);
  const concentration = [...byClient.entries()].sort((a, b) => b[1] - a[1]).map(([client, amount]) => ({ client, amount, pct: totalSold ? Math.round((amount / totalSold) * 100) : 0 }));
  const overThreshold = concentration.filter((c) => c.pct >= CONCENTRATION_ALERT_PCT);

  const signed = deals.filter((d) => d.stage === "SIGNE");
  const refused = deals.filter((d) => d.stage === "REFUSE");
  const closingRate = signed.length + refused.length ? Math.round((signed.length / (signed.length + refused.length)) * 100) : 0;
  const lossByReason = new Map<string, { n: number; amount: number }>();
  for (const d of refused) {
    const r = d.lossReason ?? "Non qualifié";
    const cur = lossByReason.get(r) ?? { n: 0, amount: 0 };
    lossByReason.set(r, { n: cur.n + 1, amount: cur.amount + d.amount });
  }
  const lostTotal = refused.reduce((s, d) => s + d.amount, 0);

  const bestPerformer = [...teamProfit].sort((a, b) => b.marginPct - a.marginPct)[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Pilotage</h1>
        <p className="mt-1 text-sm text-muted">trésorerie, équipe, risque client, transformation</p>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Objectif du mois</h2>
          <span className="text-sm text-muted">{fmtEUR(revenueThisMonth)} / {fmtEUR(monthlyRevenueTarget)}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${behindPace ? "bg-amber" : "bg-mint"}`} style={{ width: `${revenuePct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">
          {revenuePct}% de l’objectif encaissé · {Math.round(pace * 100)}% du mois écoulé
          {behindPace ? " — en retard sur le rythme attendu" : " — sur la bonne voie"}.
        </p>
        {behindPace && suggestions.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-xs font-medium text-amber">Pistes pour rattraper l’objectif :</p>
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
                <span className="text-text">{s.text}</span>
                <Link href={s.href} className="shrink-0 rounded-lg border border-mint/30 px-2.5 py-1 text-xs font-medium text-mint hover:bg-mint/10">
                  {s.cta}
                </Link>
              </div>
            ))}
          </div>
        ) : null}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-mint">Modifier l’objectif mensuel</summary>
          <form action={updateMonthlyRevenueTargetAction} className="mt-2 flex items-center gap-2">
            <input
              name="monthlyRevenueTarget"
              type="number"
              min="1"
              step="1000"
              defaultValue={monthlyRevenueTarget}
              className="input w-40"
            />
            <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs text-text">Enregistrer</button>
          </form>
        </details>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Trésorerie — 90 jours</h2>
        <div className="mt-3 grid grid-cols-3 gap-4">
          {months.map((month) => {
            const items = cashItems.filter((c) => c.monthLabel === month);
            const sureTotal = items.filter((i) => i.sure).reduce((s, i) => s + i.amount, 0);
            const net = sureTotal - monthlyCharges;
            return (
              <div key={month} className="rounded-lg border border-border bg-panel-2 p-3">
                <p className="text-sm font-medium text-text">{month}</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-xs">
                      <span className={it.sure ? "text-muted" : "text-amber"}>{it.label}</span>
                      <span className={it.sure ? "text-text" : "text-amber"}>{fmtEUR(it.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 border-t border-border pt-2 text-xs text-muted">charges {fmtEUR(monthlyCharges)}</div>
                <div className={`mt-1 text-sm font-semibold ${net >= 0 ? "text-mint" : "text-red"}`}>net {net >= 0 ? "+" : ""}{fmtEUR(net)}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">Net calculé sur les seuls encaissements sûrs (les montants sous condition sont en ambre).</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-mint">Modifier les charges mensuelles</summary>
          <form action={updateMonthlyChargesAction} className="mt-2 flex items-center gap-2">
            <input
              name="monthlyCharges"
              type="number"
              min="0"
              step="100"
              defaultValue={monthlyCharges}
              className="input w-40"
            />
            <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs text-text">Enregistrer</button>
          </form>
        </details>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Rentabilité par personne</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">Nom</th><th className="px-3 py-2 font-medium">Facturable</th>
              <th className="px-3 py-2 font-medium">Interne</th><th className="px-3 py-2 font-medium">Taux</th>
              <th className="px-3 py-2 font-medium">Coût</th><th className="px-3 py-2 font-medium">Produit</th><th className="px-3 py-2 font-medium">Marge</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {teamProfit.map((tp) => (
                <tr key={tp.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-text">{tp.user.name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{fmtHours(tp.billableHours)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{fmtHours(tp.internalHours)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{tp.billableRatePct}%</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{fmtEUR(tp.cost)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{fmtEUR(tp.revenue)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={tp.marginPct >= 0 ? "font-medium text-mint" : "font-medium text-red"}>{tp.marginPct >= 0 ? "+" : ""}{tp.marginPct}%</span>
                    {tp.note ? <span className="ml-2 text-xs text-muted">{tp.note}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {bestPerformer ? (
          <p className="mt-3 text-xs text-muted">{bestPerformer.user.name} dégage la meilleure marge ({bestPerformer.marginPct}%) ; les rôles à forte part de coordination (cheffe de projet, direction) sont structurellement moins facturables.</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold text-text">Dépendance client</h2>
          <div className="mt-3 flex flex-col gap-2">
            {concentration.map((c) => (
              <div key={c.client} className="flex items-center gap-3 text-sm">
                <span className="w-32 truncate text-text">{c.client}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${c.pct >= CONCENTRATION_ALERT_PCT ? "bg-red" : "bg-mint"}`} style={{ width: `${c.pct}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-muted">{fmtEUR(c.amount)}</span>
                <span className="w-10 shrink-0 text-right text-muted">{c.pct}%</span>
              </div>
            ))}
          </div>
          {overThreshold.length > 0 ? (
            <p className="mt-3 text-xs text-amber">Seuil d’alerte à {CONCENTRATION_ALERT_PCT}% franchi par {overThreshold.map((c) => `${c.client} (${c.pct}%)`).join(", ")}.</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold text-text">Transformation</h2>
          <p className="mt-1 text-2xl font-semibold text-text">{closingRate}%</p>
          <p className="text-xs text-muted">de signature sur les affaires tranchées ({signed.length} signées, {refused.length} refusées)</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {[...lossByReason.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([reason, v]) => (
              <div key={reason} className="flex items-center justify-between text-sm">
                <span className="text-text">{reason}</span>
                <span className="text-muted">{v.n} · {fmtEUR(v.amount)}{lostTotal ? ` (${Math.round((v.amount / lostTotal) * 100)}%)` : ""}</span>
              </div>
            ))}
            {lossByReason.size === 0 ? <p className="text-sm text-muted">Aucun refus enregistré.</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Historique des décisions</h2>
        <div className="mt-3 flex flex-col divide-y divide-border">
          {decisions.map((dec) => (
            <div key={dec.id} className="py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-text">{dec.title}</span>
                <span className="text-xs text-muted">{fmtDate(dec.date)} · {dec.author.name}</span>
              </div>
              <p className="mt-0.5 text-muted">{dec.detail}</p>
              <p className="mt-0.5 text-xs text-mint">{dec.impact} · <span className="text-muted">{dec.tag}</span></p>
            </div>
          ))}
        </div>
        <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-mint">+ Consigner une décision</summary>
          <form action={addDecisionAction} className="mt-2 flex flex-col gap-2">
            <input name="title" placeholder="Titre" required className="input" />
            <input name="detail" placeholder="Détail" className="input" />
            <div className="grid grid-cols-2 gap-2">
              <input name="impact" placeholder="Impact" className="input" />
              <input name="tag" placeholder="Catégorie" className="input" />
            </div>
            <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Enregistrer</button>
          </form>
        </details>
      </div>
    </div>
  );
}
