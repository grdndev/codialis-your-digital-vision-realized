import { requireUser } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import type { RhScreen } from "./types";
import { fmtHours, fmtDate, currentMonthBounds, currentWeekdays, currentPeriodLabel } from "@/lib/format";
import {
  addOvertimeAction, validateOvertimeAction, setPlannedShiftAction, addTravelAction, validateTravelAction,
} from "./actions";
import type { ShiftKind } from "@/lib/types";

const SHIFT_KINDS: ShiftKind[] = ["BUREAU", "TELETRAVAIL", "CLIENT", "ABSENCE"];
const SHIFT_LABEL: Record<ShiftKind, string> = {
  BUREAU: "Bureau",
  TELETRAVAIL: "Télétravail",
  CLIENT: "Chez le client",
  ABSENCE: "Absence",
};
const SHIFT_CLASS: Record<ShiftKind, string> = {
  BUREAU: "bg-white/5 text-muted",
  TELETRAVAIL: "bg-blue/10 text-blue",
  CLIENT: "bg-mint/10 text-mint",
  ABSENCE: "bg-amber/10 text-amber",
};
const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

export default async function RhPage() {
  const user = await requireUser();
  const { start: monthStart, end: monthEnd } = currentMonthBounds();
  const weekdays = currentWeekdays();

  // Les bornes de période partent d'ici : la grille du planning retrouve ses
  // créneaux par égalité exacte de date, un seul endroit doit décider ce
  // qu'est « cette semaine ».
  const query = new URLSearchParams({
    monthStart: monthStart.toISOString(),
    monthEnd: monthEnd.toISOString(),
  });
  for (const day of weekdays) query.append("weekday", day.toISOString());

  const { myOvertime, myShifts, myTravel, team, allOvertime, allTravel } =
    await apiGet<RhScreen>(`/api/admin/rh?${query}`);
  const myOvertimeTotal = myOvertime.reduce((s, e) => s + e.hours, 0);
  const shiftByDay = new Map(myShifts.map((s) => [dateKey(s.date), s]));

  let teamSummary: { id: string; name: string; overtimeHours: number; overtimeValidated: number; travelCount: number }[] = [];
  let pending: { id: string; kind: "overtime" | "travel"; who: string; label: string; detail: string }[] = [];
  if (user.role === "DIR") {
    teamSummary = team.map((u) => {
      const entries = allOvertime.filter((e) => e.userId === u.id);
      return {
        id: u.id,
        name: u.name,
        overtimeHours: entries.reduce((s, e) => s + e.hours, 0),
        overtimeValidated: entries.filter((e) => e.status === "VALIDE").reduce((s, e) => s + e.hours, 0),
        travelCount: allTravel.filter((t) => t.userId === u.id).length,
      };
    });
    pending = [
      ...allOvertime.filter((e) => e.status === "DECLARE").map((e) => ({
        id: e.id, kind: "overtime" as const, who: e.user.name,
        label: `${fmtHours(e.hours)} le ${fmtDate(e.date)}`, detail: e.reason,
      })),
      ...allTravel.filter((t) => t.status === "DECLARE").map((t) => ({
        id: t.id, kind: "travel" as const, who: t.user.name,
        label: `${t.destination} · ${fmtDate(t.startDate)}${t.endDate ? ` → ${fmtDate(t.endDate)}` : ""}`, detail: t.motif,
      })),
    ];
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Ressources humaines</h1>
        <p className="mt-1 text-sm text-muted">Heures supplémentaires, planning, déplacements · {currentPeriodLabel()}</p>
      </div>

      {user.role === "DIR" ? (
        <>
          <div className="rounded-xl border border-border bg-panel p-5">
            <h2 className="text-sm font-semibold text-text">Synthèse mensuelle équipe</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">Nom</th>
                  <th className="px-3 py-2 font-medium">Heures supp. déclarées</th>
                  <th className="px-3 py-2 font-medium">dont validées</th>
                  <th className="px-3 py-2 font-medium">Déplacements</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {teamSummary.map((t) => (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-text">{t.name}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted">{fmtHours(t.overtimeHours)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted">{fmtHours(t.overtimeValidated)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted">{t.travelCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel p-5">
            <h2 className="text-sm font-semibold text-text">À valider</h2>
            <div className="mt-3 flex flex-col divide-y divide-border">
              {pending.length === 0 ? (
                <p className="py-2 text-sm text-muted">Rien en attente de validation ce mois-ci.</p>
              ) : (
                pending.map((p) => (
                  <div key={`${p.kind}:${p.id}`} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <div>
                      <p className="text-text">{p.who} · {p.label}</p>
                      {p.detail ? <p className="text-xs text-muted">{p.detail}</p> : null}
                    </div>
                    <form action={(p.kind === "overtime" ? validateOvertimeAction : validateTravelAction).bind(null, p.id)}>
                      <button type="submit" className="shrink-0 rounded-lg border border-mint/30 px-2.5 py-1 text-xs font-medium text-mint hover:bg-mint/10">
                        Valider
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Mon planning</h2>
        <div className="mt-3 grid grid-cols-5 gap-3">
          {weekdays.map((day) => {
            const key = dateKey(day);
            const shift = shiftByDay.get(key);
            const kind = shift?.kind ?? "BUREAU";
            return (
              <div key={key} className="rounded-lg border border-border bg-panel-2 p-3">
                <p className="text-xs font-medium text-text">{DAY_LABEL_FORMATTER.format(day)}</p>
                <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${SHIFT_CLASS[kind]}`}>
                  {SHIFT_LABEL[kind]}
                </span>
                <form action={setPlannedShiftAction} className="mt-2 flex flex-col gap-1.5">
                  <input type="hidden" name="date" value={key} />
                  <select name="kind" defaultValue={kind} className="input text-xs">
                    {SHIFT_KINDS.map((k) => <option key={k} value={k}>{SHIFT_LABEL[k]}</option>)}
                  </select>
                  <button type="submit" className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted hover:text-text">
                    Enregistrer
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Mes heures supplémentaires</h2>
            <span className="text-sm font-semibold text-text">{fmtHours(myOvertimeTotal)}</span>
          </div>
          <div className="mt-3 flex flex-col divide-y divide-border">
            {myOvertime.length === 0 ? (
              <p className="py-2 text-sm text-muted">Aucune heure supplémentaire déclarée ce mois-ci.</p>
            ) : (
              myOvertime.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <p className="text-text">{fmtHours(e.hours)} · {fmtDate(e.date)}</p>
                    {e.reason ? <p className="text-xs text-muted">{e.reason}</p> : null}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${e.status === "VALIDE" ? "bg-mint/10 text-mint" : "bg-white/5 text-muted"}`}>
                    {e.status === "VALIDE" ? "Validé" : "Déclaré"}
                  </span>
                </div>
              ))
            )}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-mint">+ Déclarer des heures supp.</summary>
            <form action={addOvertimeAction} className="mt-2 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <input name="date" type="date" required className="input" />
                <input name="hours" placeholder="Heures (ex : 2)" required className="input" />
              </div>
              <input name="reason" placeholder="Motif (optionnel)" className="input" />
              <button type="submit" className="self-start rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Déclarer</button>
            </form>
          </details>
        </div>

        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold text-text">Mes déplacements</h2>
          <div className="mt-3 flex flex-col divide-y divide-border">
            {myTravel.length === 0 ? (
              <p className="py-2 text-sm text-muted">Aucun déplacement déclaré.</p>
            ) : (
              myTravel.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <p className="text-text">{t.destination}</p>
                    <p className="text-xs text-muted">
                      {fmtDate(t.startDate)}{t.endDate ? ` → ${fmtDate(t.endDate)}` : ""}{t.motif ? ` · ${t.motif}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${t.status === "VALIDE" ? "bg-mint/10 text-mint" : "bg-white/5 text-muted"}`}>
                    {t.status === "VALIDE" ? "Validé" : "Déclaré"}
                  </span>
                </div>
              ))
            )}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-mint">+ Déclarer un déplacement</summary>
            <form action={addTravelAction} className="mt-2 flex flex-col gap-2">
              <input name="destination" placeholder="Destination" required className="input" />
              <div className="grid grid-cols-2 gap-2">
                <input name="startDate" type="date" required className="input" />
                <input name="endDate" type="date" className="input" />
              </div>
              <input name="motif" placeholder="Motif (optionnel)" className="input" />
              <button type="submit" className="self-start rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Déclarer</button>
            </form>
          </details>
        </div>
      </div>
    </div>
  );
}
