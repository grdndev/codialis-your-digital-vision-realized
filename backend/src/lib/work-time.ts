import { isHoliday, isoOf } from "@/lib/work-calendar";

// Temps mesuré : répartition du temps écoulé entre les tâches menées en
// parallèle par une même personne.
//
// Ce module ne touche ni la base ni la session : c'est du calcul pur, donc
// testable seul (voir prisma/test-work-time.ts). Les deux règles qu'il applique :
//
//   1. ROGNAGE — une session ne compte que pendant les horaires de la personne.
//      Une tâche laissée « en cours » un vendredi soir ne doit pas compter la
//      nuit, le week-end, la pause déjeuner ni les jours fériés.
//   2. PARTAGE — sur chaque instant, le temps se divise par le nombre de
//      sessions ouvertes. Deux tâches menées de front une heure donnent une
//      demi-heure chacune.
//
// Le découpage se fait par segments et non par simple division du total : cela
// rend juste le cas des recouvrements partiels. A de 9h à 13h et B de 11h à 13h
// donnent A = 3h et B = 1h, pas 2h chacune.

export type Schedule = {
  startMin: number;
  breakStartMin: number | null;
  breakEndMin: number | null;
  endMin: number;
  // Jours ISO travaillés : 1 = lundi … 7 = dimanche.
  weekdays: number[];
  overtimeStartMin: number | null;
  overtimeEndMin: number | null;
};

export type Session = {
  id: string;
  startedAt: Date;
  // Une session encore ouverte est bornée à `now` par l'appelant.
  endedAt: Date;
};

export const DEFAULT_SCHEDULE: Schedule = {
  startMin: 9 * 60,
  breakStartMin: 12 * 60,
  breakEndMin: 13 * 60,
  endMin: 18 * 60,
  weekdays: [1, 2, 3, 4, 5],
  overtimeStartMin: null,
  overtimeEndMin: null,
};

export function parseWeekdays(raw: string): number[] {
  const days = raw
    .split(",")
    .map((d) => Number.parseInt(d.trim(), 10))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  return days.length ? [...new Set(days)].sort((a, b) => a - b) : [1, 2, 3, 4, 5];
}

// Jour ISO de la semaine d'une date, en UTC : 1 = lundi … 7 = dimanche.
function isoWeekday(d: Date): number {
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

function atMinutes(day: Date, minutes: number): number {
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) + minutes * 60_000;
}

type Window = { start: number; end: number };

// Plages travaillées d'une journée : matin, après-midi, plus les heures
// supplémentaires déclarées. Une journée non travaillée ou fériée n'en a aucune.
export function windowsForDay(day: Date, schedule: Schedule): Window[] {
  if (!schedule.weekdays.includes(isoWeekday(day))) return [];
  if (isHoliday(isoOf(day))) return [];

  const windows: Window[] = [];
  const { startMin, endMin, breakStartMin, breakEndMin } = schedule;

  // Une pause mal bornée — hors des horaires, ou à l'envers — est ignorée
  // plutôt que de découper la journée n'importe comment.
  const hasBreak =
    breakStartMin !== null &&
    breakEndMin !== null &&
    breakStartMin > startMin &&
    breakEndMin > breakStartMin &&
    breakEndMin < endMin;

  if (endMin > startMin) {
    if (hasBreak) {
      windows.push({ start: atMinutes(day, startMin), end: atMinutes(day, breakStartMin!) });
      windows.push({ start: atMinutes(day, breakEndMin!), end: atMinutes(day, endMin) });
    } else {
      windows.push({ start: atMinutes(day, startMin), end: atMinutes(day, endMin) });
    }
  }

  const { overtimeStartMin, overtimeEndMin } = schedule;
  if (overtimeStartMin !== null && overtimeEndMin !== null && overtimeEndMin > overtimeStartMin) {
    windows.push({ start: atMinutes(day, overtimeStartMin), end: atMinutes(day, overtimeEndMin) });
  }

  return windows.sort((a, b) => a.start - b.start);
}

// Découpe une session sur les plages travaillées qu'elle traverse. Une session
// peut enjamber plusieurs jours : on parcourt chaque journée civile concernée.
function clipToSchedule(session: Session, schedule: Schedule): Window[] {
  const from = session.startedAt.getTime();
  const to = session.endedAt.getTime();
  if (to <= from) return [];

  const pieces: Window[] = [];
  const day = new Date(
    Date.UTC(
      session.startedAt.getUTCFullYear(),
      session.startedAt.getUTCMonth(),
      session.startedAt.getUTCDate(),
    ),
  );

  // Garde-fou : une session ouverte et oubliée des mois durant ne doit pas
  // faire boucler le calcul sur des milliers de journées.
  for (let guard = 0; guard < 400; guard++) {
    if (atMinutes(day, 0) > to) break;
    for (const w of windowsForDay(day, schedule)) {
      const start = Math.max(w.start, from);
      const end = Math.min(w.end, to);
      if (end > start) pieces.push({ start, end });
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return pieces;
}

// Temps retenu par session, en heures, après rognage et partage.
//
// Toutes les sessions passées doivent appartenir à la MÊME personne : c'est son
// temps qu'on partage, deux personnes travaillant en parallèle ne se partagent
// rien.
export function splitHours(sessions: Session[], schedule: Schedule): Map<string, number> {
  const result = new Map<string, number>(sessions.map((s) => [s.id, 0]));

  // Chaque morceau rogné devient un intervalle attribué à sa session.
  const pieces: { id: string; start: number; end: number }[] = [];
  for (const s of sessions) {
    for (const p of clipToSchedule(s, schedule)) {
      pieces.push({ id: s.id, start: p.start, end: p.end });
    }
  }
  if (!pieces.length) return result;

  // Balayage : les bornes découpent la ligne du temps en segments élémentaires
  // sur lesquels le nombre de sessions ouvertes ne change pas.
  const bounds = [...new Set(pieces.flatMap((p) => [p.start, p.end]))].sort((a, b) => a - b);

  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i];
    const to = bounds[i + 1];
    const open = pieces.filter((p) => p.start <= from && p.end >= to);
    if (!open.length) continue;

    const share = (to - from) / 3_600_000 / open.length;
    for (const p of open) result.set(p.id, (result.get(p.id) ?? 0) + share);
  }

  // Arrondi au centième d'heure : des sommes flottantes exactes n'ont pas de
  // sens pour du temps passé, et cela évite les 2.9999999999 à l'affichage.
  for (const [id, hours] of result) result.set(id, Math.round(hours * 100) / 100);
  return result;
}
