import { requireUser } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { fmtHours, fmtDate, currentMonthBounds, currentWeekdays, currentPeriodLabel } from "@/lib/format";
import type { ShiftKind } from "@/lib/types";
import {
  addHoursAction,
  decideHoursAction,
  deleteHoursAction,
  addAbsenceAction,
  decideAbsenceAction,
  deleteAbsenceAction,
  setPlannedShiftAction,
  addTravelAction,
  decideTravelAction,
  addRuleAction,
  deleteRuleAction,
  setBalancesAction,
} from "./actions";
import {
  ABSENCE_TYPE_LABEL,
  EFFECT_LABEL,
  FREQ_LABEL,
  HOURS_KIND_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  WEEKDAY_LABEL,
  type AbsenceRow,
  type Balance,
  type PresenceRuleRow,
  type RhScreen,
} from "./types";

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

// Une absence d'un seul jour peut être une demi-journée ; sinon on affiche la
// plage.
function absenceRange(a: AbsenceRow): string {
  const sameDay = dateKey(a.startDate) === dateKey(a.endDate);
  if (sameDay) {
    const half = a.halfDay === "AM" ? " (matin)" : a.halfDay === "PM" ? " (après-midi)" : "";
    return `${fmtDate(a.startDate)}${half}`;
  }
  return `${fmtDate(a.startDate)} → ${fmtDate(a.endDate)}`;
}

function ruleSummary(r: PresenceRuleRow): string {
  const when =
    r.freq === "MONTHLY"
      ? `le ${r.monthday} du mois`
      : r.freq === "DAILY"
        ? "chaque jour ouvré"
        : `${FREQ_LABEL[r.freq].toLowerCase()}, ${WEEKDAY_LABEL[r.weekday ?? 0]}`;
  const half = r.halfDay === "AM" ? " (matin)" : r.halfDay === "PM" ? " (après-midi)" : "";
  const until = r.endDate ? ` jusqu'au ${fmtDate(r.endDate)}` : "";
  return `${when}${half} · depuis le ${fmtDate(r.startDate)}${until}`;
}

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

  const {
    myHours,
    myShifts,
    myTravel,
    myAbsences,
    myRules,
    balances,
    team,
    teamBalances,
    allHours,
    allTravel,
    allAbsences,
    allRules,
  } = await apiGet<RhScreen>(`/api/admin/rh?${query}`);

  const isDir = user.role === "DIR";
  const shiftByDay = new Map(myShifts.map((s) => [dateKey(s.date), s]));
  const supTotal = myHours.filter((e) => e.kind === "SUP").reduce((s, e) => s + e.hours, 0);
  const recupTotal = myHours.filter((e) => e.kind === "RECUP").reduce((s, e) => s + e.hours, 0);
  const balanceByUser = new Map((teamBalances ?? []).map((b) => [b.userId, b]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Ressources humaines</h1>
        <p className="mt-1 text-sm text-muted">
          Heures, absences, planning, déplacements · {currentPeriodLabel()}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <BalanceCard label="Solde de congés" balance={balances.leave} unit="j" />
        <BalanceCard label="Solde d'heures" balance={balances.hours} unit="h" />
        <Kpi label="Heures supp. du mois" value={fmtHours(supTotal)} note={`${myHours.filter((e) => e.kind === "SUP").length} déclaration(s)`} />
        <Kpi label="Récupérations du mois" value={fmtHours(recupTotal)} note={`${myHours.filter((e) => e.kind === "RECUP").length} demande(s)`} />
      </div>

      {isDir ? (
        <>
          <div className="rounded-xl border border-border bg-panel p-5">
            <h2 className="text-sm font-semibold text-text">Soldes de l’équipe</h2>
            <p className="mt-1 text-xs text-muted">
              La valeur saisie est le solde réel du jour : la date devient l’ancre et le
              calcul repart de là, sans double comptage. Un congé payé ne peut pas être
              posé tant que le solde n’a pas été défini.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-3 py-2 font-medium">Nom</th>
                    <th className="px-3 py-2 font-medium">Congés dispo.</th>
                    <th className="px-3 py-2 font-medium">Heures dispo.</th>
                    <th className="px-3 py-2 font-medium">Ancré à</th>
                    <th className="px-3 py-2 font-medium">Corriger (congés / heures)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {team.map((u) => {
                    const b = balanceByUser.get(u.id);
                    return (
                      <tr key={u.id}>
                        <td className="whitespace-nowrap px-3 py-2 text-text">{u.name}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {b?.leave.defined ? (
                            <span className="text-text">{b.leave.available} j</span>
                          ) : (
                            <span className="text-amber">non défini</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted">
                          {b ? `${b.hours.available} h` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                          {u.leaveAnchorDate ? fmtDate(u.leaveAnchorDate) : "jamais"}
                        </td>
                        <td className="px-3 py-2">
                          <form action={setBalancesAction.bind(null, u.id)} className="flex items-center gap-2">
                            <input
                              name="leave"
                              placeholder={u.leaveAnchorValue !== null ? String(u.leaveAnchorValue) : "j"}
                              className="input w-20"
                            />
                            <input
                              name="hours"
                              placeholder={u.hoursAnchorValue !== null ? String(u.hoursAnchorValue) : "h"}
                              className="input w-20"
                            />
                            <button
                              type="submit"
                              className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text"
                            >
                              Enregistrer
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <ValidationQueue
            hours={allHours.filter((e) => e.status === "DECLARE")}
            absences={allAbsences.filter((a) => a.status === "DECLARE")}
            travel={allTravel.filter((t) => t.status === "DECLARE")}
          />

          <div className="rounded-xl border border-border bg-panel p-5">
            <h2 className="text-sm font-semibold text-text">Règles de présence récurrentes</h2>
            <p className="mt-1 text-xs text-muted">
              La « semaine type » de chacun. Une règle reste virtuelle : elle n’écrit rien
              dans le planning, elle s’y superpose.
            </p>
            <div className="mt-3 flex flex-col divide-y divide-border">
              {allRules.length === 0 ? (
                <p className="py-2 text-sm text-muted">Aucune règle définie.</p>
              ) : (
                allRules.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="text-text">
                        {r.user.name} · {EFFECT_LABEL[r.effect]}
                        {!r.paid ? <span className="ml-2 text-xs text-amber">non payé</span> : null}
                      </p>
                      <p className="text-xs text-muted">
                        {ruleSummary(r)}
                        {r.motif ? ` · ${r.motif}` : ""}
                      </p>
                    </div>
                    <form action={deleteRuleAction.bind(null, r.id)}>
                      <button
                        type="submit"
                        className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-red/50 hover:text-red"
                      >
                        Supprimer
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-mint">+ Ajouter une règle</summary>
              <form action={addRuleAction} className="mt-2 flex flex-col gap-2">
                <div className="grid grid-cols-3 gap-2">
                  <select name="userId" className="input">
                    <option value="all">Toute l’équipe</option>
                    {team.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <select name="effect" className="input">
                    {(Object.keys(EFFECT_LABEL) as (keyof typeof EFFECT_LABEL)[]).map((k) => (
                      <option key={k} value={k}>
                        {EFFECT_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <select name="freq" className="input">
                    {(Object.keys(FREQ_LABEL) as (keyof typeof FREQ_LABEL)[]).map((k) => (
                      <option key={k} value={k}>
                        {FREQ_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <select name="weekday" className="input" title="Pour une règle hebdomadaire ou bimensuelle">
                    {WEEKDAY_LABEL.map((label, i) => (
                      <option key={i} value={i}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input name="monthday" placeholder="Jour du mois" className="input" />
                  <select name="halfDay" className="input">
                    <option value="">Journée entière</option>
                    <option value="AM">Matin</option>
                    <option value="PM">Après-midi</option>
                  </select>
                  <input name="motif" placeholder="Motif" className="input" />
                </div>
                <div className="grid grid-cols-3 items-center gap-2">
                  <input name="startDate" type="date" required className="input" title="Début" />
                  <input name="endDate" type="date" className="input" title="Fin (optionnelle)" />
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    <input type="checkbox" name="unpaid" />
                    Non payé (ne décompte pas)
                  </label>
                </div>
                <button type="submit" className="self-start rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
                  Ajouter
                </button>
              </form>
            </details>
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
            // Une règle récurrente hebdomadaire se superpose à la case sans
            // rien y écrire : on la signale pour expliquer l'écart.
            const rule = myRules.find(
              (r) =>
                (r.freq === "WEEKLY" || r.freq === "BIWEEKLY") &&
                r.weekday === (day.getUTCDay() + 6) % 7,
            );
            return (
              <div key={key} className="rounded-lg border border-border bg-panel-2 p-3">
                <p className="text-xs font-medium text-text">{DAY_LABEL_FORMATTER.format(day)}</p>
                <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${SHIFT_CLASS[kind]}`}>
                  {SHIFT_LABEL[kind]}
                </span>
                {rule ? (
                  <p className="mt-1 text-[10px] text-blue">règle : {EFFECT_LABEL[rule.effect]}</p>
                ) : null}
                <form action={setPlannedShiftAction} className="mt-2 flex flex-col gap-1.5">
                  <input type="hidden" name="date" value={key} />
                  <select name="kind" defaultValue={kind} className="input text-xs">
                    {SHIFT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {SHIFT_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted hover:text-text"
                  >
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
          <h2 className="text-sm font-semibold text-text">Mes heures</h2>
          <div className="mt-3 flex flex-col divide-y divide-border">
            {myHours.length === 0 ? (
              <p className="py-2 text-sm text-muted">Aucune heure déclarée ce mois-ci.</p>
            ) : (
              myHours.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-text">
                      {e.kind === "RECUP" ? "− " : "+ "}
                      {fmtHours(e.hours)} · {fmtDate(e.date)}
                      {e.kind === "SUP" && e.paid ? (
                        <span className="ml-2 text-xs text-blue">payée</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted">
                      {HOURS_KIND_LABEL[e.kind]}
                      {e.reason ? ` · ${e.reason}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[e.status]}`}>
                      {STATUS_LABEL[e.status]}
                    </span>
                    {e.status !== "VALIDE" || isDir ? (
                      <form action={deleteHoursAction.bind(null, e.id)}>
                        <button
                          type="submit"
                          className="rounded-lg border border-border px-2 py-0.5 text-[11px] text-muted hover:border-red/50 hover:text-red"
                        >
                          Annuler
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-mint">+ Déclarer des heures</summary>
            <form action={addHoursAction} className="mt-2 flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-2">
                <select name="kind" className="input">
                  <option value="SUP">Heures supp.</option>
                  <option value="RECUP">Récupération</option>
                </select>
                <input name="date" type="date" required className="input" />
                <input name="hours" placeholder="Heures (ex : 2)" required className="input" />
              </div>
              <input name="reason" placeholder="Motif (optionnel)" className="input" />
              <p className="text-[11px] text-muted">
                Une récupération est refusée si elle dépasse le solde disponible — les
                demandes en attente comptent déjà.
              </p>
              <button type="submit" className="self-start rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
                Déclarer
              </button>
            </form>
          </details>
        </div>

        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold text-text">Mes absences</h2>
          <div className="mt-3 flex flex-col divide-y divide-border">
            {myAbsences.length === 0 ? (
              <p className="py-2 text-sm text-muted">Aucune absence posée.</p>
            ) : (
              myAbsences.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-text">
                      {ABSENCE_TYPE_LABEL[a.type]}
                      {!a.paid ? <span className="ml-2 text-xs text-amber">non payée</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {absenceRange(a)}
                      {a.motif ? ` · ${a.motif}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                    {a.status !== "VALIDE" || isDir ? (
                      <form action={deleteAbsenceAction.bind(null, a.id)}>
                        <button
                          type="submit"
                          className="rounded-lg border border-border px-2 py-0.5 text-[11px] text-muted hover:border-red/50 hover:text-red"
                        >
                          Annuler
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-mint">+ Poser une absence</summary>
            <form action={addAbsenceAction} className="mt-2 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <select name="type" className="input">
                  {(Object.keys(ABSENCE_TYPE_LABEL) as (keyof typeof ABSENCE_TYPE_LABEL)[]).map((k) => (
                    <option key={k} value={k}>
                      {ABSENCE_TYPE_LABEL[k]}
                    </option>
                  ))}
                </select>
                <select name="halfDay" className="input">
                  <option value="">Journée entière</option>
                  <option value="AM">Matin</option>
                  <option value="PM">Après-midi</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="startDate" type="date" required className="input" title="Début" />
                <input name="endDate" type="date" className="input" title="Fin (optionnelle)" />
              </div>
              <input name="motif" placeholder="Motif (optionnel)" className="input" />
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" name="unpaid" />
                Non payée — ne décompte pas le solde de congés
              </label>
              <p className="text-[11px] text-muted">
                Une demi-journée ne vaut que sur une absence d’un seul jour. Seuls les
                congés et absences payés décomptent le solde.
              </p>
              <button type="submit" className="self-start rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
                Poser
              </button>
            </form>
          </details>
        </div>
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
                    {fmtDate(t.startDate)}
                    {t.endDate ? ` → ${fmtDate(t.endDate)}` : ""}
                    {t.motif ? ` · ${t.motif}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[t.status]}`}>
                  {STATUS_LABEL[t.status]}
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
            <button type="submit" className="self-start rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
              Déclarer
            </button>
          </form>
        </details>
      </div>
    </div>
  );
}

// La file de validation de la direction : heures, absences et déplacements dans
// un seul endroit, chacun avec son verdict. Pour une heure sup, la direction
// tranche aussi entre payée (paie) et mise en récup.
function ValidationQueue({
  hours,
  absences,
  travel,
}: {
  hours: RhScreen["allHours"];
  absences: RhScreen["allAbsences"];
  travel: RhScreen["allTravel"];
}) {
  const total = hours.length + absences.length + travel.length;
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <h2 className="text-sm font-semibold text-text">À valider · {total}</h2>
      <div className="mt-3 flex flex-col divide-y divide-border">
        {total === 0 ? <p className="py-2 text-sm text-muted">Rien en attente.</p> : null}

        {hours.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="text-text">
                {e.user.name} · {e.kind === "RECUP" ? "− " : "+ "}
                {fmtHours(e.hours)} le {fmtDate(e.date)}
              </p>
              <p className="text-xs text-muted">
                {HOURS_KIND_LABEL[e.kind]}
                {e.reason ? ` · ${e.reason}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {e.kind === "SUP" ? (
                <>
                  <Verdict action={decideHoursAction.bind(null, e.id, "VALIDE", false)} label="En récup" tone="mint" />
                  <Verdict action={decideHoursAction.bind(null, e.id, "VALIDE", true)} label="Payée" tone="blue" />
                </>
              ) : (
                <Verdict action={decideHoursAction.bind(null, e.id, "VALIDE", false)} label="Valider" tone="mint" />
              )}
              <Verdict action={decideHoursAction.bind(null, e.id, "REFUSE", false)} label="Refuser" tone="red" />
            </div>
          </div>
        ))}

        {absences.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="text-text">
                {a.user.name} · {ABSENCE_TYPE_LABEL[a.type]}
              </p>
              <p className="text-xs text-muted">
                {absenceRange(a)}
                {a.motif ? ` · ${a.motif}` : ""}
                {!a.paid ? " · non payée" : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Verdict action={decideAbsenceAction.bind(null, a.id, "VALIDE", true)} label="Valider (payée)" tone="mint" />
              <Verdict action={decideAbsenceAction.bind(null, a.id, "VALIDE", false)} label="Sans solde" tone="amber" />
              <Verdict action={decideAbsenceAction.bind(null, a.id, "REFUSE", a.paid)} label="Refuser" tone="red" />
            </div>
          </div>
        ))}

        {travel.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="text-text">
                {t.user.name} · {t.destination}
              </p>
              <p className="text-xs text-muted">
                {fmtDate(t.startDate)}
                {t.endDate ? ` → ${fmtDate(t.endDate)}` : ""}
                {t.motif ? ` · ${t.motif}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Verdict action={decideTravelAction.bind(null, t.id, "VALIDE")} label="Valider" tone="mint" />
              <Verdict action={decideTravelAction.bind(null, t.id, "REFUSE")} label="Refuser" tone="red" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const VERDICT_CLASS: Record<string, string> = {
  mint: "border-mint/30 text-mint hover:bg-mint/10",
  blue: "border-blue/30 text-blue hover:bg-blue/10",
  amber: "border-amber/30 text-amber hover:bg-amber/10",
  red: "border-red/30 text-red hover:bg-red/10",
};

function Verdict({
  action,
  label,
  tone,
}: {
  action: () => Promise<void>;
  label: string;
  tone: keyof typeof VERDICT_CLASS;
}) {
  return (
    <form action={action}>
      <button type="submit" className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${VERDICT_CLASS[tone]}`}>
        {label}
      </button>
    </form>
  );
}

function BalanceCard({ label, balance, unit }: { label: string; balance: Balance; unit: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      {balance.defined ? (
        <p className="mt-1.5 text-2xl font-semibold text-text">
          {balance.available} {unit}
        </p>
      ) : (
        <p className="mt-1.5 text-2xl font-semibold text-amber">—</p>
      )}
      <p className="mt-1 text-xs text-muted">
        {balance.defined ? "demandes en attente déduites" : "à définir par la direction"}
      </p>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
