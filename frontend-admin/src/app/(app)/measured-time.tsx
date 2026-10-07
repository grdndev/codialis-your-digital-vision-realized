import { fmtHours, fmtOfficeDateTime, nowOfficeInput, toOfficeInput, STATUS_LABEL } from "@/lib/format";
import type { WorkSessionRow } from "@/lib/dto";
import type { Role } from "@/lib/types";
import { Popover } from "./popover";
import { correctSessionDatesAction, correctSessionHoursAction, stopSessionAction } from "./time/actions";

// Bloc « Temps mesuré », partagé par la fiche ticket et la fiche tâche : les
// sessions une à une, et leur correction après coup.
//
// Une session s'ouvre au passage « En cours », au nom de l'assigné, et se ferme
// au statut suivant ; le temps passé en découle. Un chronomètre oublié, un
// démarrage tardif ou une session restée ouverte sur un ticket clos par script
// (TRAP-041) faussaient ce temps sans recours. La personne dont c'est le temps
// et la chefferie de projet le corrigent ici — pas la direction (arbitrage du
// 07/10) : par les dates, et la durée se recalcule ; ou par la durée, qui
// remplace alors celle de cette seule session.

export function MeasuredTime({
  sessions,
  viewer,
  inProgress,
  canClose,
  back,
  projectId,
}: {
  sessions: WorkSessionRow[];
  viewer: { id: string; role: Role };
  // L'élément est-il encore « En cours » ? Arrêter sa session l'en fait sortir.
  inProgress: boolean;
  // Clôturer un ticket revient à la chefferie et à la direction (DEC-007).
  canClose: boolean;
  back: string;
  projectId: string;
}) {
  const total = sessions.reduce((sum, s) => sum + s.hours, 0);
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-text">Temps mesuré</h2>
        <span className="text-xs text-muted">
          {sessions.length} session{sessions.length > 1 ? "s" : ""} · {fmtHours(total)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Chaque passage « En cours » ouvre une session au nom de l’assigné, le statut suivant la
        ferme. Heures de bureau à La Réunion. La personne dont c’est le temps et la chefferie de
        projet peuvent la corriger.
      </p>

      {sessions.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Aucune session mesurée.</p>
      ) : (
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-2 pr-3 font-medium">Personne</th>
              <th className="py-2 pr-3 font-medium">Début</th>
              <th className="py-2 pr-3 font-medium">Fin</th>
              <th className="py-2 pr-3 font-medium">Durée</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sessions.map((s) => {
              const canCorrect = s.userId === viewer.id || viewer.role === "PM";
              return (
                <tr key={s.id} className="align-top">
                  <td className="whitespace-nowrap py-2 pr-3 text-text">{s.user.name}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-muted">{fmtOfficeDateTime(s.startedAt)}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-muted">
                    {s.endedAt ? fmtOfficeDateTime(s.endedAt) : <span className="font-medium text-mint">en cours</span>}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="whitespace-nowrap text-text">{fmtHours(s.hours)}</span>
                    {s.hoursOverride !== null ? (
                      <span
                        className="ml-1.5 rounded-full bg-amber/10 px-1.5 py-0.5 text-[10px] font-medium text-amber"
                        title={`D’après les dates : ${fmtHours(s.computedHours)}`}
                      >
                        corrigée
                      </span>
                    ) : null}
                    {s.correctedAt ? (
                      <p className="mt-0.5 text-[11px] text-muted">
                        corrigée par {s.correctedBy?.name ?? "un compte supprimé"} le {fmtOfficeDateTime(s.correctedAt)}
                        {s.hoursOverride !== null ? ` · d’après les dates : ${fmtHours(s.computedHours)}` : ""}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap py-2 text-right">
                    {!canCorrect ? null : s.endedAt ? (
                      <CorrectSession session={s} back={back} projectId={projectId} />
                    ) : (
                      <StopSession
                        session={s}
                        back={back}
                        projectId={projectId}
                        inProgress={inProgress}
                        canClose={canClose}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

const POPOVER_FORM = "flex flex-col gap-2 text-left text-xs";
const POPOVER_PANEL =
  "absolute right-0 z-10 mt-2 flex w-80 flex-col gap-4 rounded-xl border border-border bg-panel p-4 shadow-2xl";
const SUMMARY = "cursor-pointer list-none rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text";

function CorrectSession({ session, back, projectId }: { session: WorkSessionRow; back: string; projectId: string }) {
  const max = nowOfficeInput();
  return (
    <Popover summary="Corriger" summaryClassName={SUMMARY}>
      <div className={POPOVER_PANEL}>
        <form action={correctSessionDatesAction.bind(null, session.id, back, projectId)} className={POPOVER_FORM}>
          <p className="font-medium text-text">Par les dates</p>
          <label className="flex flex-col gap-1 text-muted">
            Début
            <input
              type="datetime-local"
              name="startedAt"
              required
              max={max}
              defaultValue={toOfficeInput(session.startedAt)}
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1 text-muted">
            Fin
            <input
              type="datetime-local"
              name="endedAt"
              required
              max={max}
              defaultValue={toOfficeInput(session.endedAt!)}
              className="input"
            />
          </label>
          <p className="text-muted">
            La durée se recalcule (horaires de bureau, partage avec les autres sessions) et remplace
            une durée corrigée.
          </p>
          <button type="submit" className="self-start rounded-lg bg-mint px-3 py-1.5 font-semibold text-bg">
            Recalculer
          </button>
        </form>
        <form
          action={correctSessionHoursAction.bind(null, session.id, back, projectId)}
          className={`${POPOVER_FORM} border-t border-border pt-4`}
        >
          <p className="font-medium text-text">Par la durée</p>
          <label className="flex items-center gap-2 text-muted">
            <input
              name="hours"
              inputMode="decimal"
              required
              defaultValue={String(Math.round(session.hours * 100) / 100).replace(".", ",")}
              className="input w-24"
              aria-label="Durée en heures"
            />
            h
          </label>
          <p className="text-muted">
            Remplace la durée de cette session seulement. D’après les dates : {fmtHours(session.computedHours)}.
          </p>
          <button type="submit" className="self-start rounded-lg bg-mint px-3 py-1.5 font-semibold text-bg">
            Retenir cette durée
          </button>
        </form>
      </div>
    </Popover>
  );
}

function StopSession({
  session,
  back,
  projectId,
  inProgress,
  canClose,
}: {
  session: WorkSessionRow;
  back: string;
  projectId: string;
  inProgress: boolean;
  canClose: boolean;
}) {
  const now = nowOfficeInput();
  return (
    <Popover summary="Arrêter à…" summaryClassName={SUMMARY}>
      <form
        action={stopSessionAction.bind(null, session.id, back, projectId)}
        className={`${POPOVER_PANEL} ${POPOVER_FORM}`}
      >
        <p className="font-medium text-text">Arrêter la session</p>
        <label className="flex flex-col gap-1 text-muted">
          Fin réelle
          <input
            type="datetime-local"
            name="endedAt"
            required
            min={toOfficeInput(session.startedAt)}
            max={now}
            defaultValue={now}
            className="input"
          />
        </label>
        {inProgress ? (
          <label className="flex flex-col gap-1 text-muted">
            Puis passer en
            <select name="status" defaultValue="A_FAIRE" className="input">
              <option value="A_FAIRE">{STATUS_LABEL.A_FAIRE}</option>
              <option value="EN_REVUE">{STATUS_LABEL.EN_REVUE}</option>
              {canClose ? <option value="TERMINE">{STATUS_LABEL.TERMINE}</option> : null}
            </select>
          </label>
        ) : (
          <p className="text-amber">
            L’élément n’est plus « En cours » : seule cette session restée ouverte se ferme.
          </p>
        )}
        <button type="submit" className="self-start rounded-lg bg-mint px-3 py-1.5 font-semibold text-bg">
          Arrêter
        </button>
      </form>
    </Popover>
  );
}
