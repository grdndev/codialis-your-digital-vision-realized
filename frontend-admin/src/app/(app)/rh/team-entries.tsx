import { fmtDate, fmtHours } from "@/lib/format";
import type { HrEntryStatus } from "@/lib/types";
import { FilterLink, FilterRow, toggleValue } from "../list-controls";
import { ABSENCE_TYPE_LABEL, SHIFT_LABEL, STATUS_CLASS, STATUS_LABEL, type RhScreen } from "./types";

// « Saisies de l'équipe » (CC-362, CC-363) : tout ce que l'équipe a saisi en RH
// sur le mois affiché — heures sup et récupérations, congés et absences,
// déplacements, planning de la semaine — quel qu'en soit le statut. La file
// « À valider » ne montre que ce qui attend un verdict : une fois tranchée, une
// saisie n'était plus lisible nulle part par la direction, sinon en pastille
// du calendrier.

export const ENTRY_TYPES = ["heures", "absences", "deplacements", "planning"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

const TYPE_LABEL: Record<EntryType, string> = {
  heures: "Heures sup. et récup.",
  absences: "Congés et absences",
  deplacements: "Déplacements",
  planning: "Planning",
};

const TYPE_CLASS: Record<EntryType, string> = {
  heures: "bg-blue/10 text-blue",
  absences: "bg-amber/10 text-amber",
  deplacements: "bg-white/10 text-text",
  planning: "bg-mint/10 text-mint",
};

const HR_STATUSES: HrEntryStatus[] = ["DECLARE", "VALIDE", "REFUSE"];

type Line = {
  key: string;
  date: Date;
  userId: string;
  who: string;
  type: EntryType;
  // La nature précise : Heures sup., Récupération, Congé, Déplacement…
  label: string;
  what: string;
  note: string;
  // NULL pour le planning, qui se pose sans validation.
  status: HrEntryStatus | null;
  // Ce que la direction a décidé en validant : payée, mise en récup…
  decision: string;
  // Pour les totaux par personne.
  sup: number;
  recup: number;
  absenceDays: number;
  travel: number;
};

const sameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

function range(start: Date, end: Date | null): string {
  return end && !sameDay(start, end) ? `${fmtDate(start)} → ${fmtDate(end)}` : (fmtDate(start) ?? "");
}

const fmtDays = (n: number) => `${String(n).replace(".", ",")} j`;

function linesOf(data: Pick<RhScreen, "allHours" | "allAbsences" | "allTravel" | "allShifts">): Line[] {
  const zero = { sup: 0, recup: 0, absenceDays: 0, travel: 0 };
  const lines: Line[] = [
    ...data.allHours.map((e) => ({
      ...zero,
      key: `h-${e.id}`,
      date: e.date,
      userId: e.user.id,
      who: e.user.name,
      type: "heures" as const,
      label: e.kind === "SUP" ? "Heures sup." : "Récupération",
      what: `${e.kind === "RECUP" ? "− " : "+ "}${fmtHours(e.hours)} le ${fmtDate(e.date)}`,
      note: e.reason,
      status: e.status,
      decision: e.kind === "SUP" && e.status === "VALIDE" ? (e.paid ? "payée" : "mise en récup") : "",
      sup: e.kind === "SUP" ? e.hours : 0,
      recup: e.kind === "RECUP" ? e.hours : 0,
    })),
    ...data.allAbsences.map((a) => ({
      ...zero,
      key: `a-${a.id}`,
      date: a.startDate,
      userId: a.user.id,
      who: a.user.name,
      type: "absences" as const,
      label: ABSENCE_TYPE_LABEL[a.type],
      what: `${range(a.startDate, a.endDate)}${a.halfDay ? (a.halfDay === "AM" ? " (matin)" : " (après-midi)") : ""} · ${fmtDays(a.monthDays)} ce mois-ci`,
      note: a.motif,
      status: a.status,
      decision: a.paid ? "" : "non payée",
      // Le télétravail n'est pas une absence : il ne compte pas dans les jours.
      absenceDays: a.type === "TELETRAVAIL" ? 0 : a.monthDays,
    })),
    ...data.allTravel.map((t) => ({
      ...zero,
      key: `t-${t.id}`,
      date: t.startDate,
      userId: t.user.id,
      who: t.user.name,
      type: "deplacements" as const,
      label: "Déplacement",
      what: `${t.destination} · ${range(t.startDate, t.endDate)}`,
      note: t.motif,
      status: t.status,
      decision: "",
      travel: 1,
    })),
    ...data.allShifts.map((s) => ({
      ...zero,
      key: `s-${s.id}`,
      date: s.date,
      userId: s.user.id,
      who: s.user.name,
      type: "planning" as const,
      label: SHIFT_LABEL[s.kind],
      what: fmtDate(s.date) ?? "",
      note: s.note,
      status: null,
      decision: "",
    })),
  ];
  // Dans l'ordre du mois : c'est ainsi qu'on le relit, semaine après semaine.
  return lines.sort((a, b) => a.date.getTime() - b.date.getTime() || a.who.localeCompare(b.who, "fr"));
}

export type TeamEntriesFilters = { qui: string[]; type: string[]; statut: string[] };

export function TeamEntries({
  data,
  people,
  monthLabel,
  filters,
  hrefFor,
}: {
  data: Pick<RhScreen, "allHours" | "allAbsences" | "allTravel" | "allShifts">;
  people: { id: string; name: string }[];
  monthLabel: string;
  filters: TeamEntriesFilters;
  hrefFor: (next: Partial<Record<keyof TeamEntriesFilters, string | null>>) => string;
}) {
  const all = linesOf(data);
  // Le planning n'a pas de statut : dès qu'on filtre sur un statut, il sort de
  // la liste plutôt que d'y passer pour « validé ».
  const lines = all.filter(
    (l) =>
      (!filters.qui.length || filters.qui.includes(l.userId)) &&
      (!filters.type.length || filters.type.includes(l.type)) &&
      (!filters.statut.length || (l.status !== null && filters.statut.includes(l.status))),
  );

  // Totaux par personne, filtres compris ; un refus ne compte pas.
  const totals = new Map<string, { who: string; supValid: number; supPending: number; recup: number; absenceDays: number; travel: number }>();
  for (const l of lines) {
    if (l.status === "REFUSE") continue;
    const t = totals.get(l.userId) ?? { who: l.who, supValid: 0, supPending: 0, recup: 0, absenceDays: 0, travel: 0 };
    if (l.status === "VALIDE") t.supValid += l.sup;
    else t.supPending += l.sup;
    t.recup += l.recup;
    t.absenceDays += l.absenceDays;
    t.travel += l.travel;
    totals.set(l.userId, t);
  }
  const summary = [...totals.values()].sort((a, b) => a.who.localeCompare(b.who, "fr"));
  const filtered = filters.qui.length + filters.type.length + filters.statut.length > 0;

  return (
    <div id="saisies" className="scroll-mt-6 rounded-xl border border-border bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-text">Saisies de l’équipe · {monthLabel}</h2>
        <span className="text-xs text-muted">
          {lines.length} saisie{lines.length > 1 ? "s" : ""}
          {filtered ? ` sur ${all.length}` : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Tout ce qui a été saisi en RH ce mois-ci, validé, refusé ou en attente : heures, congés et
        absences, déplacements, et le planning de la semaine (hors jours au bureau).
      </p>

      <div className="mt-4 flex flex-col gap-2 text-xs">
        <FilterRow label="Personne">
          <FilterLink href={hrefFor({ qui: null })} active={!filters.qui.length}>
            Toute l’équipe
          </FilterLink>
          {people.map((p) => (
            <FilterLink key={p.id} href={hrefFor({ qui: toggleValue(filters.qui, p.id) })} active={filters.qui.includes(p.id)}>
              {p.name}
            </FilterLink>
          ))}
        </FilterRow>
        <FilterRow label="Type">
          <FilterLink href={hrefFor({ type: null })} active={!filters.type.length}>
            Tous types
          </FilterLink>
          {ENTRY_TYPES.map((t) => (
            <FilterLink key={t} href={hrefFor({ type: toggleValue(filters.type, t) })} active={filters.type.includes(t)}>
              {TYPE_LABEL[t]}
            </FilterLink>
          ))}
        </FilterRow>
        <FilterRow label="Statut">
          <FilterLink href={hrefFor({ statut: null })} active={!filters.statut.length}>
            Tous statuts
          </FilterLink>
          {HR_STATUSES.map((s) => (
            <FilterLink key={s} href={hrefFor({ statut: toggleValue(filters.statut, s) })} active={filters.statut.includes(s)}>
              {STATUS_LABEL[s]}
            </FilterLink>
          ))}
        </FilterRow>
      </div>

      {summary.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-3 py-2 font-medium">Personne</th>
                <th className="px-3 py-2 font-medium">Heures sup.</th>
                <th className="px-3 py-2 font-medium">Récupérations</th>
                <th className="px-3 py-2 font-medium" title="Congés, absences et formations, en jours ouvrés du mois">
                  Jours d’absence
                </th>
                <th className="px-3 py-2 font-medium">Déplacements</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.map((t) => (
                <tr key={t.who}>
                  <td className="whitespace-nowrap px-3 py-2 text-text">{t.who}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-text">
                    {t.supValid || t.supPending ? fmtHours(t.supValid) : "—"}
                    {t.supPending ? <span className="ml-1.5 text-xs text-muted">+ {fmtHours(t.supPending)} en attente</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-text">{t.recup ? fmtHours(t.recup) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-text">{t.absenceDays ? fmtDays(t.absenceDays) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-text">{t.travel || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-[11px] text-muted">
            Les refus ne comptent pas. Le télétravail ne compte pas comme absence.
          </p>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        {lines.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            {all.length === 0 ? "Aucune saisie ce mois-ci." : "Aucune saisie pour ces filtres."}
          </p>
        ) : (
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Personne</th>
                <th className="px-3 py-2 font-medium">Nature</th>
                <th className="px-3 py-2 font-medium">Détail</th>
                <th className="px-3 py-2 font-medium">Motif · note</th>
                <th className="px-3 py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((l) => (
                <tr key={l.key} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{fmtDate(l.date)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-text">{l.who}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_CLASS[l.type]}`}>{l.label}</span>
                  </td>
                  <td className="px-3 py-2 text-text">{l.what}</td>
                  <td className="whitespace-pre-wrap px-3 py-2 text-muted">{l.note || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {l.status ? (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[l.status]}`}>
                        {STATUS_LABEL[l.status]}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">sans validation</span>
                    )}
                    {l.decision ? <span className="ml-1.5 text-xs text-muted">{l.decision}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
