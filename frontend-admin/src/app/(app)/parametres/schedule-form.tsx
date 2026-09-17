import { updateScheduleAction } from "./actions";

// Réglage des horaires de travail. Rendu côté serveur : des champs `time` et
// des cases à cocher suffisent, aucun état à tenir dans le navigateur.

export type ScheduleSettings = {
  startMin: number;
  breakStartMin: number | null;
  breakEndMin: number | null;
  endMin: number;
  weekdays: string;
  overtimeStartMin: number | null;
  overtimeEndMin: number | null;
  isDefault: boolean;
};

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 0, label: "Dim" },
];

function hhmm(minutes: number | null): string {
  if (minutes === null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function TimeField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: number | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-xs font-medium text-muted">
        {label}
      </label>
      <input id={name} name={name} type="time" defaultValue={hhmm(value)} className="input" />
    </div>
  );
}

export function ScheduleForm({ schedule }: { schedule: ScheduleSettings }) {
  const active = new Set(
    schedule.weekdays
      .split(",")
      .map((d) => Number(d.trim()))
      .filter((d) => Number.isInteger(d)),
  );

  return (
    <form action={updateScheduleAction} className="mt-4 flex flex-col gap-5">
      <div className="grid max-w-xl grid-cols-2 gap-4 sm:grid-cols-4">
        <TimeField name="start" label="Début" value={schedule.startMin} />
        <TimeField name="breakStart" label="Pause" value={schedule.breakStartMin} />
        <TimeField name="breakEnd" label="Reprise" value={schedule.breakEndMin} />
        <TimeField name="end" label="Fin" value={schedule.endMin} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted">Jours travaillés</p>
        <div className="flex flex-wrap gap-3">
          {DAYS.map((day) => (
            <label
              key={day.value}
              className="flex cursor-pointer items-center gap-1.5 text-sm text-text"
            >
              <input
                type="checkbox"
                name="weekdays"
                value={day.value}
                defaultChecked={active.has(day.value)}
                className="accent-mint"
              />
              {day.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted">Heures supplémentaires</p>
        <div className="grid max-w-sm grid-cols-2 gap-4">
          <TimeField name="overtimeStart" label="Début" value={schedule.overtimeStartMin} />
          <TimeField name="overtimeEnd" label="Fin" value={schedule.overtimeEndMin} />
        </div>
        <p className="max-w-xl text-xs text-muted">
          Plage comptée en plus des horaires habituels — une soirée de mise en production,
          par exemple. Laissée vide, rien n’est compté en dehors des horaires.
        </p>
      </div>

      <button
        type="submit"
        className="self-start rounded-lg bg-mint px-4 py-2 text-xs font-semibold text-bg transition hover:brightness-110"
      >
        Enregistrer
      </button>
    </form>
  );
}
