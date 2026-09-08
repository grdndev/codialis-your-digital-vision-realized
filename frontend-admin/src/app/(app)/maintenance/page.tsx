import Link from "next/link";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import type { MaintenanceScreen } from "./types";
import { fmtHours, fmtEUR, fmtDate, daysFromNow } from "@/lib/format";
import { startMaintenanceContractAction } from "./actions";

export default async function MaintenancePage() {
  await requireRole("PM", "DIR");

  const { warranty, contracts } = await apiGet<MaintenanceScreen>("/api/admin/maintenance");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Maintenance &amp; garantie</h1>
        <p className="mt-1 text-sm text-muted">
          {warranty.length} projets sous garantie · {contracts.length} contrats actifs
        </p>
      </div>

      <div className="rounded-xl border border-border bg-panel">
        <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold text-text">Sous garantie</h2></div>
        <div className="flex flex-col divide-y divide-border">
          {warranty.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">Aucun projet sous garantie.</p>
          ) : (
            warranty.map((p) => {
              const days = p.deadlineAt ? daysFromNow(p.deadlineAt) : null;
              return (
                <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/projects/${p.id}`} className="text-text hover:text-mint">{p.client.name} — {p.name}</Link>
                    <p className="text-xs text-muted">livré {fmtDate(p.closedAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className={days !== null && days <= 10 ? "font-medium text-amber" : "text-muted"}>
                      {days !== null ? (days >= 0 ? `garantie · ${days} j` : "garantie échue") : "—"}
                    </span>
                    <details>
                      <summary className="cursor-pointer list-none rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:text-text">Proposer un contrat</summary>
                      <form action={startMaintenanceContractAction} className="mt-2 flex items-end gap-2">
                        <input type="hidden" name="projectId" value={p.id} />
                        <label className="flex flex-col gap-1 text-xs text-muted">Prix mensuel €<input name="monthlyPrice" className="input w-24" /></label>
                        <label className="flex flex-col gap-1 text-xs text-muted">Heures incluses<input name="includedHours" className="input w-20" /></label>
                        <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Démarrer</button>
                      </form>
                    </details>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel">
        <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold text-text">Contrats de maintenance</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-5 py-3 font-medium">Client</th><th className="px-5 py-3 font-medium">Prix</th>
              <th className="px-5 py-3 font-medium">Heures du mois</th><th className="px-5 py-3 font-medium">Renouvellement</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {contracts.map((c) => {
                const over = c.usedHoursThisMonth > c.includedHours;
                return (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-5 py-3">
                      <Link href={`/projects/${c.project.id}`} className="text-text hover:text-mint">{c.project.client.name} — {c.project.name}</Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{fmtEUR(c.monthlyPrice)} / mois</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className={over ? "font-medium text-amber" : "text-muted"}>{fmtHours(c.usedHoursThisMonth)} / {fmtHours(c.includedHours)}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{c.renewalNote}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
