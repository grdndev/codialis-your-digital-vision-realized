import { buildCalendar, eachDay, recurrenceDays } from "../src/lib/hr-calendar";
import type { RecurrenceInput } from "../src/lib/hr-calendar";

// Vérification du calendrier RH : étalement des absences, des règles
// récurrentes et des déplacements sur les jours d'une période.
//
//   npx tsx prisma/test-hr-calendar.ts

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, extra = "") {
  if (ok) {
    pass++;
    console.log("  ok  " + label);
  } else {
    fail++;
    console.log("FAIL  " + label + (extra ? " :: " + extra : ""));
  }
}

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// Novembre 2026 : le 2 est un lundi.
const from = d("2026-11-01");
const to = d("2026-11-30");

console.log("— Étendue d'une période");
check("30 jours en novembre", eachDay(from, to).length === 30, String(eachDay(from, to).length));
check("un seul jour si début = fin", eachDay(d("2026-11-05"), d("2026-11-05")).length === 1);
check("période à l'envers : aucun jour", eachDay(d("2026-11-10"), d("2026-11-05")).length === 0);

console.log("\n— Règles récurrentes");
const weekly: RecurrenceInput = {
  userId: "u1", effect: "TELETRAVAIL", freq: "WEEKLY", weekday: 4, monthday: null,
  halfDay: null, startDate: d("2026-11-01"), endDate: null, motif: "Télétravail",
};
const vendredis = recurrenceDays(weekly, from, to).map((x) => x.toISOString().slice(0, 10));
check("tous les vendredis de novembre", vendredis.length === 4, JSON.stringify(vendredis));
check("ce sont bien des vendredis", vendredis.every((iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 5), JSON.stringify(vendredis));

const biweekly: RecurrenceInput = { ...weekly, freq: "BIWEEKLY", weekday: 0, startDate: d("2026-11-02") };
const lundis = recurrenceDays(biweekly, from, to).map((x) => x.toISOString().slice(0, 10));
check("un lundi sur deux depuis le 2", JSON.stringify(lundis) === JSON.stringify(["2026-11-02", "2026-11-16", "2026-11-30"]), JSON.stringify(lundis));

const monthly: RecurrenceInput = { ...weekly, freq: "MONTHLY", weekday: null, monthday: 15 };
check("une fois par mois, le 15", recurrenceDays(monthly, from, to).length === 1);

const daily: RecurrenceInput = { ...weekly, freq: "DAILY", weekday: null, startDate: d("2026-11-10"), endDate: d("2026-11-12") };
check("quotidienne, bornée par ses dates", recurrenceDays(daily, from, to).length === 3);

const before: RecurrenceInput = { ...weekly, startDate: d("2026-12-01") };
check("une règle qui commence après la période ne rend rien", recurrenceDays(before, from, to).length === 0);

const present: RecurrenceInput = { ...weekly, effect: "PRESENT" };
check("« présent » n'est pas une absence", recurrenceDays(present, from, to).length === 0);

console.log("\n— Calendrier complet");
const calendar = buildCalendar(from, to, {
  absences: [
    {
      userId: "u1", type: "CONGE", startDate: d("2026-11-09"), endDate: d("2026-11-13"),
      halfDay: null, motif: "Congés",
    },
    // Débordant de la période : elle doit être rognée, pas ignorée.
    {
      userId: "u2", type: "FORMATION", startDate: d("2026-10-28"), endDate: d("2026-11-03"),
      halfDay: null, motif: "Formation",
    },
  ],
  recurrences: [weekly],
  travels: [
    { userId: "u2", startDate: d("2026-11-20"), endDate: null, destination: "Paris" },
  ],
});

check("les congés couvrent leurs 5 jours", ["09", "10", "11", "12", "13"].every((day) => (calendar[`2026-11-${day}`] ?? []).some((e) => e.userId === "u1" && e.kind === "CONGE")), JSON.stringify(Object.keys(calendar)));
check("rien le 8 (dimanche hors congé)", !(calendar["2026-11-08"] ?? []).some((e) => e.userId === "u1" && e.kind === "CONGE"));
check("l'absence à cheval est rognée au 1er", (calendar["2026-11-01"] ?? []).some((e) => e.userId === "u2" && e.kind === "FORMATION"));
check("et ne déborde pas après le 3", !(calendar["2026-11-04"] ?? []).some((e) => e.userId === "u2"));
check("le télétravail du vendredi apparaît", (calendar["2026-11-06"] ?? []).some((e) => e.userId === "u1" && e.kind === "TELETRAVAIL"));
check("un déplacement sans fin tient un jour", (calendar["2026-11-20"] ?? []).some((e) => e.kind === "DEPLACEMENT" && e.motif === "Paris") && !(calendar["2026-11-21"] ?? []).some((e) => e.kind === "DEPLACEMENT"));
check("le motif remonte", (calendar["2026-11-09"] ?? []).some((e) => e.motif === "Congés"));

const doubled = buildCalendar(d("2026-11-06"), d("2026-11-06"), {
  absences: [{ userId: "u1", type: "TELETRAVAIL", startDate: d("2026-11-06"), endDate: d("2026-11-06"), halfDay: null, motif: "x" }],
  recurrences: [weekly],
  travels: [],
});
check("pas de doublon quand règle et saisie disent la même chose", doubled["2026-11-06"].length === 1, JSON.stringify(doubled["2026-11-06"]));

console.log(`\n${pass} vérifications passées, ${fail} en échec`);
process.exit(fail ? 1 : 0);
