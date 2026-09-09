// Vérifie le calendrier ouvré français : fériés, jours travaillés, mois révolus.
//
//   npx tsx prisma/test-work-calendar.ts
//
// Ce module est pur (ni base, ni session), le test tourne donc sans démarrer
// l'application. Les soldes qui s'appuient dessus se vérifient, eux, à travers
// l'API — ils lisent la base.
import { isHoliday, leaveDaysInRange, monthsBetweenIso } from "@/lib/work-calendar";

let failures = 0;

function check(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  const suffix = ok ? "" : ` (attendu ${JSON.stringify(want)})`;
  console.log(`  ${ok ? "OK   " : "ÉCHEC"} ${label} -> ${JSON.stringify(got)}${suffix}`);
}

console.log("Jours fériés France 2026");
check("1er janvier", isHoliday("2026-01-01"), true);
check("1er mai", isHoliday("2026-05-01"), true);
check("8 mai", isHoliday("2026-05-08"), true);
check("14 juillet", isHoliday("2026-07-14"), true);
check("15 août", isHoliday("2026-08-15"), true);
check("1er novembre", isHoliday("2026-11-01"), true);
check("11 novembre", isHoliday("2026-11-11"), true);
check("25 décembre", isHoliday("2026-12-25"), true);
// Pâques 2026 tombe le 5 avril : lundi de Pâques le 6, Ascension le 14 mai,
// lundi de Pentecôte le 25 mai.
check("lundi de Pâques", isHoliday("2026-04-06"), true);
check("Ascension", isHoliday("2026-05-14"), true);
check("lundi de Pentecôte", isHoliday("2026-05-25"), true);
check("un mardi ordinaire", isHoliday("2026-03-10"), false);

console.log("\nJours ouvrés d'une plage");
check("lundi -> vendredi", leaveDaysInRange("2026-09-21", "2026-09-25", false, null), 5);
check("week-end non compté", leaveDaysInRange("2026-09-21", "2026-09-27", false, null), 5);
check("semaine avec le 1er mai férié", leaveDaysInRange("2026-04-27", "2026-05-01", false, null), 4);
check("un seul jour", leaveDaysInRange("2026-09-22", "2026-09-22", false, null), 1);
check("demi-journée", leaveDaysInRange("2026-09-22", "2026-09-22", true, null), 0.5);
check("samedi seul", leaveDaysInRange("2026-09-26", "2026-09-26", false, null), 0);
check("ancre postérieure : rien ne compte", leaveDaysInRange("2026-09-21", "2026-09-25", false, "2026-09-30"), 0);
check("ancre au milieu", leaveDaysInRange("2026-09-21", "2026-09-25", false, "2026-09-22"), 3);
check("fin absente = un seul jour", leaveDaysInRange("2026-09-22", null, false, null), 1);

console.log("\nMois révolus (acquisition de 2,5 j par mois)");
check("1er juillet -> 1er septembre", monthsBetweenIso("2026-07-01", "2026-09-01"), 2);
check("1er juillet -> 31 août", monthsBetweenIso("2026-07-01", "2026-08-31"), 1);
check("même jour", monthsBetweenIso("2026-07-01", "2026-07-01"), 0);
check("dates inversées", monthsBetweenIso("2026-09-01", "2026-07-01"), 0);
check("passage d'année", monthsBetweenIso("2025-11-15", "2026-02-15"), 3);

console.log(failures === 0 ? "\nTous les cas passent." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
