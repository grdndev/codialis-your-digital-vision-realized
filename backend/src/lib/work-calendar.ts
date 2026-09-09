
// Calendrier ouvré français : fériés, jours travaillés, mois révolus.
//
// Ce module ne touche ni la base ni la session : il est donc importable et
// testable hors du contexte Next (voir prisma/test-work-calendar.ts). Les
// soldes eux-mêmes vivent dans balances.ts.
//
// Tout se compte en dates civiles au format YYYY-MM-DD : un congé est posé sur
// des jours, pas sur des instants.

function pad2(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

export function isoOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export function todayIso(): string {
  return isoOf(new Date());
}

// Dimanche de Pâques par l'algorithme de Gauss/Meeus (calendrier grégorien) —
// il fixe les trois fériés mobiles français.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const HOLIDAY_CACHE: Record<number, Set<string>> = {};

// Jours fériés France métropolitaine.
function frenchHolidays(year: number): Set<string> {
  const cached = HOLIDAY_CACHE[year];
  if (cached) return cached;

  const days = new Set<string>();
  const add = (d: Date) => days.add(isoOf(d));
  // Fériés fixes.
  add(new Date(Date.UTC(year, 0, 1))); // Jour de l'an
  add(new Date(Date.UTC(year, 4, 1))); // Fête du travail
  add(new Date(Date.UTC(year, 4, 8))); // Victoire 1945
  add(new Date(Date.UTC(year, 6, 14))); // Fête nationale
  add(new Date(Date.UTC(year, 7, 15))); // Assomption
  add(new Date(Date.UTC(year, 10, 1))); // Toussaint
  add(new Date(Date.UTC(year, 10, 11))); // Armistice 1918
  add(new Date(Date.UTC(year, 11, 25))); // Noël
  // Fériés mobiles, calés sur Pâques.
  const easter = easterSunday(year);
  add(addDays(easter, 1)); // Lundi de Pâques
  add(addDays(easter, 39)); // Ascension
  add(addDays(easter, 50)); // Lundi de Pentecôte

  HOLIDAY_CACHE[year] = days;
  return days;
}

export function isHoliday(iso: string): boolean {
  const year = Number(iso.slice(0, 4));
  return year ? frenchHolidays(year).has(iso) : false;
}

// Jours ouvrés (lundi-vendredi, hors fériés) de la plage inclusive
// [start..end], en ne comptant que ceux STRICTEMENT après l'ancre. Une
// demi-journée ne vaut que sur une plage d'un seul jour, d'où le facteur 0,5
// appliqué au total.
export function leaveDaysInRange(
  startIso: string,
  endIso: string | null,
  halfDay: boolean,
  afterIso: string | null,
): number {
  if (!startIso) return 0;
  const end = parseIso(endIso || startIso);
  let d = parseIso(startIso);
  let total = 0;
  while (d <= end) {
    const iso = isoOf(d);
    const weekday = (d.getUTCDay() + 6) % 7; // 0 = lundi
    if ((!afterIso || iso > afterIso) && weekday < 5 && !isHoliday(iso)) total += 1;
    d = addDays(d, 1);
  }
  return halfDay ? total * 0.5 : total;
}

// Mois COMPLETS écoulés entre deux dates — l'acquisition est de 2,5 j par mois
// révolu, pas au prorata.
export function monthsBetweenIso(fromIso: string, toIso: string): number {
  if (!fromIso || !toIso || toIso <= fromIso) return 0;
  const a = parseIso(fromIso);
  const b = parseIso(toIso);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

