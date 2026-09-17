import { isoOf } from "@/lib/work-calendar";

// Qui est là, jour par jour.
//
// Trois sources se superposent : les absences saisies, les règles récurrentes
// (télétravail le vendredi, formation un lundi sur deux) et les déplacements.
// Ce module ne fait que les étaler sur des dates — il ne lit pas la base et ne
// connaît pas de session, ce qui le rend vérifiable seul.
//
// Convention de jour de semaine : 0 = lundi … 6 = dimanche, celle du modèle.

export type DayKind = "TELETRAVAIL" | "CONGE" | "ABSENCE" | "FORMATION" | "DEPLACEMENT";
export type HalfDay = "AM" | "PM" | null;

export type CalendarEntry = {
  userId: string;
  kind: DayKind;
  halfDay: HalfDay;
  motif: string;
};

export type AbsenceInput = {
  userId: string;
  type: DayKind;
  startDate: Date;
  endDate: Date;
  halfDay: HalfDay;
  motif: string;
};

export type RecurrenceInput = {
  userId: string;
  effect: "PRESENT" | "TELETRAVAIL" | "CONGE" | "ABSENCE" | "FORMATION";
  freq: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "DAILY";
  weekday: number | null;
  monthday: number | null;
  halfDay: HalfDay;
  startDate: Date;
  endDate: Date | null;
  motif: string;
};

export type TravelInput = {
  userId: string;
  startDate: Date;
  endDate: Date | null;
  destination: string;
};

function atUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// 0 = lundi, pour coller au modèle — `getUTCDay()` compte à partir de dimanche.
function mondayFirstWeekday(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cursor = atUtcMidnight(from);
  const last = atUtcMidnight(to);
  // Garde-fou : une période absurde ne doit pas boucler sans fin.
  for (let i = 0; cursor <= last && i < 400; i++) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

// Les jours où une règle récurrente s'applique, dans la fenêtre demandée.
export function recurrenceDays(rule: RecurrenceInput, from: Date, to: Date): Date[] {
  if (rule.effect === "PRESENT") return [];

  const start = atUtcMidnight(rule.startDate);
  const end = rule.endDate ? atUtcMidnight(rule.endDate) : null;

  return eachDay(from, to).filter((day) => {
    if (day < start) return false;
    if (end && day > end) return false;

    switch (rule.freq) {
      case "DAILY":
        return true;
      case "WEEKLY":
        return rule.weekday !== null && mondayFirstWeekday(day) === rule.weekday;
      case "BIWEEKLY": {
        if (rule.weekday === null || mondayFirstWeekday(day) !== rule.weekday) return false;
        // La parité se compte depuis le début de la règle : une semaine sur
        // deux à partir de là, pas une semaine paire du calendrier.
        const weeks = Math.floor((day.getTime() - start.getTime()) / (7 * 86_400_000));
        return weeks % 2 === 0;
      }
      case "MONTHLY":
        return rule.monthday !== null && day.getUTCDate() === rule.monthday;
    }
  });
}

// Le calendrier d'une période : une entrée par personne et par jour concerné,
// rangée par date ISO.
export function buildCalendar(
  from: Date,
  to: Date,
  sources: {
    absences: AbsenceInput[];
    recurrences: RecurrenceInput[];
    travels: TravelInput[];
  },
): Record<string, CalendarEntry[]> {
  const byDay: Record<string, CalendarEntry[]> = {};
  const push = (day: Date, entry: CalendarEntry) => {
    const key = isoOf(day);
    if (!byDay[key]) byDay[key] = [];
    // Une même personne peut être concernée deux fois le même jour par une
    // absence et une règle : on ne garde qu'une ligne par nature.
    if (byDay[key].some((e) => e.userId === entry.userId && e.kind === entry.kind)) return;
    byDay[key].push(entry);
  };

  for (const absence of sources.absences) {
    for (const day of eachDay(
      absence.startDate < from ? from : absence.startDate,
      absence.endDate > to ? to : absence.endDate,
    )) {
      push(day, {
        userId: absence.userId,
        kind: absence.type,
        halfDay: absence.halfDay,
        motif: absence.motif,
      });
    }
  }

  for (const rule of sources.recurrences) {
    for (const day of recurrenceDays(rule, from, to)) {
      push(day, {
        userId: rule.userId,
        kind: rule.effect as DayKind,
        halfDay: rule.halfDay,
        motif: rule.motif,
      });
    }
  }

  for (const travel of sources.travels) {
    // Un déplacement sans date de fin tient sur la seule journée de départ.
    const end = travel.endDate ?? travel.startDate;
    for (const day of eachDay(
      travel.startDate < from ? from : travel.startDate,
      end > to ? to : end,
    )) {
      push(day, {
        userId: travel.userId,
        kind: "DEPLACEMENT",
        halfDay: null,
        motif: travel.destination,
      });
    }
  }

  return byDay;
}
