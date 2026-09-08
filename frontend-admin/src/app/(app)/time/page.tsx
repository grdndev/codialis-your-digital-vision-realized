import { requireUser } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import type { TimeScreen } from "./types";
import { fmtHours } from "@/lib/format";
import { addTimeEntryAction } from "./actions";

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function dayLabel(key: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${key}T09:00:00.000Z`));
}

export default async function TimePage() {
  const user = await requireUser();

  const { entries, activeProjects, allProjects, openTasks, openTickets } =
    await apiGet<TimeScreen>("/api/admin/time");

  const days = [...new Set(entries.map((e) => dateKey(e.date)))].sort().slice(-5);

  const weekEntries = entries.filter((e) => days.includes(dateKey(e.date)));
  const totalHours = weekEntries.reduce((s, e) => s + e.hours, 0);
  const billableHours = weekEntries.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0);
  const byPerson = new Map<string, number>();
  for (const e of weekEntries) byPerson.set(e.user.name, (byPerson.get(e.user.name) ?? 0) + e.hours);

  const alerts = activeProjects
    .map((p) => ({ p, pct: Math.round((p.hoursSpent / p.hoursSold) * 100) }))
    .filter((x) => x.pct >= 80)
    .sort((a, b) => b.pct - a.pct);

  const myEntries = weekEntries.filter((e) => e.userId === user.id);
  const myGroups = new Map<string, { label: string; project: string; d: Record<string, number> }>();
  for (const e of myEntries) {
    const key = `${e.label}::${e.project?.client.name ?? "—"}`;
    if (!myGroups.has(key)) myGroups.set(key, { label: e.label, project: e.project?.client.name ?? "—", d: {} });
    const g = myGroups.get(key)!;
    g.d[dateKey(e.date)] = (g.d[dateKey(e.date)] ?? 0) + e.hours;
  }

  const teamGroups = new Map<string, { who: string; label: string; project: string; bill: boolean; source: string; d: Record<string, number> }>();
  for (const e of weekEntries) {
    const key = `${e.userId}::${e.label}::${e.projectId}`;
    if (!teamGroups.has(key)) teamGroups.set(key, { who: e.user.name, label: e.label, project: e.project?.client.name ?? "—", bill: e.billable, source: e.source, d: {} });
    teamGroups.get(key)!.d[dateKey(e.date)] = (teamGroups.get(key)!.d[dateKey(e.date)] ?? 0) + e.hours;
  }

  const todayKey = days[days.length - 1] ?? dateKey(new Date());


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Suivi du temps</h1>
        <p className="mt-1 text-sm text-muted">
          {fmtHours(totalHours)} dont {fmtHours(billableHours)} facturables · {[...byPerson.entries()].map(([n, h]) => `${n.split(" ")[0]} ${fmtHours(h)}`).join(" · ")}
        </p>
      </div>

      {alerts.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber/30 bg-amber/5 p-4">
          <p className="text-sm font-medium text-text">Alertes de budget</p>
          {alerts.map(({ p, pct }) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-text">{p.client.name} — {p.name}</span>
              <span className={pct >= 100 ? "font-medium text-red" : "font-medium text-amber"}>
                {pct}% · {fmtHours(p.hoursSpent)} / {fmtHours(p.hoursSold)} {pct >= 100 ? "— dépassé, chiffrer un avenant" : "— seuil 80% franchi, prévenir le client"}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-panel">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead><tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-4 py-3 font-medium">Projet</th><th className="px-4 py-3 font-medium">Heures</th><th className="px-4 py-3 font-medium">Avancement</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {activeProjects.map((p) => {
              const pct = Math.round((p.hoursSpent / p.hoursSold) * 100);
              return (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-text">{p.client.name} — {p.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtHours(p.hoursSpent)} / {fmtHours(p.hoursSold)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full rounded-full ${pct >= 100 ? "bg-red" : pct >= 80 ? "bg-amber" : "bg-mint"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className="text-xs text-muted">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Ma semaine — {user.name}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">Tâche</th><th className="px-3 py-2 font-medium">Projet</th>
              {days.map((day) => <th key={day} className="px-3 py-2 text-right font-medium">{dayLabel(day)}</th>)}
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {[...myGroups.values()].map((g, i) => {
                const rowTotal = Object.values(g.d).reduce((s, v) => s + v, 0);
                return (
                  <tr key={i}>
                    <td className="px-3 py-2 text-text">{g.label}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{g.project}</td>
                    {days.map((day) => <td key={day} className="px-3 py-2 text-right text-muted">{g.d[day] ? fmtHours(g.d[day]) : "—"}</td>)}
                    <td className="px-3 py-2 text-right font-medium text-text">{fmtHours(rowTotal)}</td>
                  </tr>
                );
              })}
              {myGroups.size === 0 ? (
                <tr><td colSpan={days.length + 3} className="px-3 py-4 text-center text-muted">Aucune saisie cette semaine.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <form action={addTimeEntryAction} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">Tâche<input name="label" required className="input w-48" /></label>
          <label className="flex flex-col gap-1 text-xs text-muted">Projet
            <select name="projectId" className="input w-44">
              <option value="">Interne / autre</option>
              {allProjects.map((p) => <option key={p.id} value={p.id}>{p.client.name} — {p.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">Rattaché à (optionnel)
            <select name="linkedTo" className="input w-56">
              <option value="">Aucun · projet seul</option>
              <optgroup label="Tâches">
                {openTasks.map((t) => (
                  <option key={t.id} value={`task:${t.id}`}>{t.epic.project.client.name} — {t.title}</option>
                ))}
              </optgroup>
              <optgroup label="Tickets">
                {openTickets.map((t) => (
                  <option key={t.id} value={`ticket:${t.id}`}>{t.project.client.name} — {t.title}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">Date<input name="date" type="date" defaultValue={todayKey} className="input w-36" /></label>
          <label className="flex flex-col gap-1 text-xs text-muted">Heures<input name="hours" placeholder="1,5" className="input w-20" /></label>
          <label className="flex items-center gap-1.5 pb-2 text-xs text-muted"><input name="billable" type="checkbox" defaultChecked /> Facturable</label>
          <button type="submit" className="rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-bg">Envoyer</button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Saisies de l’équipe</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[750px] border-collapse text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">Qui</th><th className="px-3 py-2 font-medium">Tâche</th><th className="px-3 py-2 font-medium">Projet</th>
              <th className="px-3 py-2 font-medium">Facturable</th><th className="px-3 py-2 font-medium">Source</th>
              {days.map((day) => <th key={day} className="px-3 py-2 text-right font-medium">{dayLabel(day)}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-border">
              {[...teamGroups.values()].map((g, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-3 py-2 text-text">{g.who}</td>
                  <td className="px-3 py-2 text-muted">{g.label}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{g.project}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{g.bill ? "oui" : "non"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{g.source}</td>
                  {days.map((day) => <td key={day} className="px-3 py-2 text-right text-muted">{g.d[day] ? fmtHours(g.d[day]) : "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
