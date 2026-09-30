import { DEFAULT_SCHEDULE, parseWeekdays, splitHours, windowsForDay } from "../src/lib/work-time";
import type { Schedule, Session } from "../src/lib/work-time";

//   npx tsx prisma/test-work-time.ts
//
// Le calcul du temps mesuré, éprouvé hors base : rognage sur les horaires et
// partage entre tâches menées de front.

let fails = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) fails++;
}
function near(a: number, b: number) {
  return Math.abs(a - b) < 0.011;
}

// Mercredi 16 septembre 2026, jour ouvré ordinaire. `at` donne l'INSTANT
// correspondant à une heure locale de La Réunion (UTC+4) : c'est dans cette
// heure-là que s'expriment les horaires.
const at = (day: number, h: number, m = 0) => new Date(Date.UTC(2026, 8, day, h - 4, m));
const localDay = (day: number) => new Date(Date.UTC(2026, 8, day));
const s = (id: string, from: Date, to: Date): Session => ({ id, startedAt: from, endedAt: to });

console.log("── Rognage sur les horaires ──");
let hours = splitHours([s("a", at(16, 8), at(16, 20))], DEFAULT_SCHEDULE);
check("une session 8h-20h ne retient que 9h-12h + 13h-18h = 8h", near(hours.get("a")!, 8), String(hours.get("a")));

hours = splitHours([s("a", at(16, 11), at(16, 14))], DEFAULT_SCHEDULE);
check("la pause déjeuner est retirée (11h-14h = 2h)", near(hours.get("a")!, 2), String(hours.get("a")));

// Vendredi 18 au lundi 21 : le week-end ne compte pas.
hours = splitHours([s("a", at(18, 17), at(21, 10))], DEFAULT_SCHEDULE);
check("oubliée du vendredi 17h au lundi 10h = 1h + 1h", near(hours.get("a")!, 2), String(hours.get("a")));

// 11 novembre 2026, férié.
hours = splitHours(
  [{ id: "a", startedAt: new Date(Date.UTC(2026, 10, 11, 5)), endedAt: new Date(Date.UTC(2026, 10, 11, 13)) }],
  DEFAULT_SCHEDULE,
);
check("un jour férié ne compte pas", near(hours.get("a")!, 0), String(hours.get("a")));

console.log("\n── Partage entre tâches parallèles ──");
hours = splitHours([s("a", at(16, 9), at(16, 13)), s("b", at(16, 9), at(16, 13))], DEFAULT_SCHEDULE);
check("l'exemple de Jayan : 4h à deux → 2h chacune", near(hours.get("a")!, 1.5) && near(hours.get("b")!, 1.5),
  `a=${hours.get("a")} b=${hours.get("b")} (9h-13h rogné de la pause 12h-13h = 3h partagées)`);

hours = splitHours([s("a", at(16, 9), at(16, 12)), s("b", at(16, 9), at(16, 12))], DEFAULT_SCHEDULE);
check("3h pleines à deux → 1,5h chacune", near(hours.get("a")!, 1.5) && near(hours.get("b")!, 1.5), `a=${hours.get("a")} b=${hours.get("b")}`);

hours = splitHours([s("a", at(16, 9), at(16, 12)), s("b", at(16, 10), at(16, 12))], DEFAULT_SCHEDULE);
check("recouvrement partiel : A 9h-12h, B 10h-12h → A=2h, B=1h", near(hours.get("a")!, 2) && near(hours.get("b")!, 1), `a=${hours.get("a")} b=${hours.get("b")}`);

hours = splitHours(
  [s("a", at(16, 9), at(16, 12)), s("b", at(16, 9), at(16, 12)), s("c", at(16, 9), at(16, 12))],
  DEFAULT_SCHEDULE,
);
check("trois de front sur 3h → 1h chacune", [..."abc"].every((k) => near(hours.get(k)!, 1)), JSON.stringify([...hours]));

hours = splitHours([s("a", at(16, 9), at(16, 12)), s("b", at(16, 14), at(16, 16))], DEFAULT_SCHEDULE);
check("sessions disjointes : rien n'est partagé", near(hours.get("a")!, 3) && near(hours.get("b")!, 2), `a=${hours.get("a")} b=${hours.get("b")}`);

console.log("\n── Le total ne dépasse jamais le temps réellement écoulé ──");
hours = splitHours([s("a", at(16, 9), at(16, 12)), s("b", at(16, 10), at(16, 11)), s("c", at(16, 9), at(16, 10))], DEFAULT_SCHEDULE);
const total = [...hours.values()].reduce((x, y) => x + y, 0);
check("trois sessions imbriquées somment à 3h de mur", near(total, 3), `total=${total.toFixed(2)} détail=${JSON.stringify([...hours])}`);

console.log("\n── Horaires personnalisés ──");
const nightOwl: Schedule = { ...DEFAULT_SCHEDULE, startMin: 14 * 60, breakStartMin: null, breakEndMin: null, endMin: 22 * 60 };
hours = splitHours([s("a", at(16, 9), at(16, 20))], nightOwl);
check("horaires 14h-22h sans pause : 9h-20h → 6h", near(hours.get("a")!, 6), String(hours.get("a")));

// Plus de plage supplémentaire dans les horaires : une soirée se déclare en RH.
hours = splitHours([s("a", at(16, 17), at(16, 22))], DEFAULT_SCHEDULE);
check("soirée 19h-21h non comptée", near(hours.get("a")!, 1), `${hours.get("a")} (17h-18h seulement)`);

const sixDays: Schedule = { ...DEFAULT_SCHEDULE, weekdays: [1, 2, 3, 4, 5, 6] };
hours = splitHours([s("a", at(19, 9), at(19, 12))], sixDays);
check("samedi travaillé si déclaré", near(hours.get("a")!, 3), String(hours.get("a")));

console.log("\n── Cas limites ──");
check("aucune session → aucun temps", splitHours([], DEFAULT_SCHEDULE).size === 0);
hours = splitHours([s("a", at(16, 10), at(16, 10))], DEFAULT_SCHEDULE);
check("session de durée nulle → 0h", near(hours.get("a")!, 0), String(hours.get("a")));
hours = splitHours([s("a", at(16, 20), at(16, 22))], DEFAULT_SCHEDULE);
check("session entièrement hors horaires → 0h", near(hours.get("a")!, 0), String(hours.get("a")));
check("jours de semaine mal formés → semaine ouvrée par défaut", JSON.stringify(parseWeekdays("bof")) === "[1,2,3,4,5]");
check("pause à l'envers ignorée",
  windowsForDay(localDay(16), { ...DEFAULT_SCHEDULE, breakStartMin: 800, breakEndMin: 700 }).length === 1);

console.log("\n── Heure de La Réunion (UTC+4) ──");
// Les sessions sont des INSTANTS (UTC en base), les horaires des heures de
// bureau à La Réunion. Le calcul lisait les horaires en UTC : 9h-12h devenait
// 13h-16h locales, et le travail du matin comptait 0 h.
const utc = (iso: string) => new Date(iso);
hours = splitHours([s("a", utc("2026-09-30T07:20:00Z"), utc("2026-09-30T07:45:00Z"))], DEFAULT_SCHEDULE);
check("11h20-11h45 à La Réunion (07h20-07h45 UTC) = 25 min", near(hours.get("a")!, 0.42), String(hours.get("a")));
hours = splitHours([s("a", utc("2026-09-30T05:00:00Z"), utc("2026-09-30T09:00:00Z"))], DEFAULT_SCHEDULE);
check("9h-13h locales (05h-09h UTC) = 3 h, pause retirée", near(hours.get("a")!, 3), String(hours.get("a")));
hours = splitHours([s("a", utc("2026-09-30T13:00:00Z"), utc("2026-09-30T15:00:00Z"))], DEFAULT_SCHEDULE);
check("17h-19h locales (13h-15h UTC) = 1 h, arrêt à 18h", near(hours.get("a")!, 1), String(hours.get("a")));
// Vendredi 2 octobre 22h UTC = samedi 3 octobre 2h à La Réunion.
hours = splitHours([s("a", utc("2026-10-02T21:00:00Z"), utc("2026-10-03T06:00:00Z"))], DEFAULT_SCHEDULE);
check("le samedi local ne compte pas, même s'il est encore vendredi en UTC", near(hours.get("a")!, 0), String(hours.get("a")));
// Un lundi ordinaire : la session commence avant l'ouverture du bureau.
hours = splitHours([s("a", utc("2026-11-02T04:00:00Z"), utc("2026-11-02T06:00:00Z"))], DEFAULT_SCHEDULE);
check("lundi 2 novembre 8h-10h locales = 1 h (dès 9h)", near(hours.get("a")!, 1), String(hours.get("a")));

console.log(fails ? `\n${fails} échec(s)` : "\nCalcul du temps mesuré : tout passe");
process.exit(fails ? 1 : 0);
