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

// Mercredi 16 septembre 2026, jour ouvré ordinaire.
const at = (day: number, h: number, m = 0) => new Date(Date.UTC(2026, 8, day, h, m));
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
  [{ id: "a", startedAt: new Date(Date.UTC(2026, 10, 11, 9)), endedAt: new Date(Date.UTC(2026, 10, 11, 17)) }],
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

const withOvertime: Schedule = { ...DEFAULT_SCHEDULE, overtimeStartMin: 19 * 60, overtimeEndMin: 21 * 60 };
hours = splitHours([s("a", at(16, 17), at(16, 22))], withOvertime);
check("heures supplémentaires 19h-21h comptées", near(hours.get("a")!, 3), `${hours.get("a")} (17h-18h + 19h-21h)`);

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
  windowsForDay(at(16, 0), { ...DEFAULT_SCHEDULE, breakStartMin: 800, breakEndMin: 700 }).length === 1);

console.log(fails ? `\n${fails} échec(s)` : "\nCalcul du temps mesuré : tout passe");
process.exit(fails ? 1 : 0);
