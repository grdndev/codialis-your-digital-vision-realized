import { apiGet } from "@/lib/api";
import { portalQuery, requireClientProject, type PortalProject } from "@/lib/client-project";
import type { PortalEpic, PortalProgressScreen } from "./types";
import { fmtDate, daysFromNow, coverageStatus, GROUP_LABEL, GROUP_BADGE_CLASS, TICKET_TYPE_LABEL } from "@/lib/format";
import {
  CLIENT_STATE_LABEL,
  CLIENT_STATE_BADGE_CLASS,
  dueCountdown,
  movedThisWeek,
  sortOpenTickets,
  type FeatureTicket,
} from "@/lib/features";

// Portail client — « Avancement » (CC-374) : où en est le projet, pour quand,
// et ce qui a bougé. Les épics d'abord, dans leur ordre, puis les tickets hors
// épic, que le pourcentage d'avancement compte aussi (DEC-064).

export default async function PortalProgressPage() {
  const { project } = await requireClientProject();

  const { epics, others } = await apiGet<PortalProgressScreen>(
    `/api/admin/client/progress?${portalQuery(project)}`,
    "/portal",
  );
  const featureEpics = epics.filter((e) => e.tickets.length > 0);
  const all = [...featureEpics.flatMap((e) => e.tickets), ...others];
  const moved = movedThisWeek(all);
  const delivered = all.filter((t) => t.status === "TERMINE").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Avancement du projet</h1>
          <p className="mt-1 text-sm text-muted">{project.name} · espace client</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${GROUP_BADGE_CLASS[project.group]}`}>
          {project.phaseLabel || GROUP_LABEL[project.group]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Avancement" value={`${project.progressPct} %`}>
          <Bar pct={project.progressPct} />
          {all.length > 0 ? (
            <p className="mt-1.5 text-xs text-muted">{delivered} livré{delivered > 1 ? "s" : ""} sur {all.length}</p>
          ) : null}
        </Stat>
        <DeadlineStat project={project} />
        <CoverageStat project={project} />
        <Stat label="Dernière activité" value={fmtDate(project.lastActivityAt) ?? "—"} />
      </div>

      {moved.delivered.length + moved.testing.length + moved.started.length > 0 ? (
        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold text-text">Ce qui a bougé cette semaine</h2>
          <div className="mt-3 grid grid-cols-3 gap-4">
            <MovedColumn title="Livré" items={moved.delivered} color="text-mint" />
            <MovedColumn title="En test" items={moved.testing} color="text-blue" />
            <MovedColumn title="Démarré" items={moved.started} color="text-amber" />
          </div>
        </div>
      ) : null}

      {all.length === 0 ? (
        <p className="rounded-xl border border-border bg-panel px-5 py-6 text-sm text-muted">Le découpage détaillé n’est pas encore disponible.</p>
      ) : null}

      {featureEpics.map((epic) => <EpicCard key={epic.id} epic={epic} />)}

      {others.length > 0 ? <OthersCard tickets={others} titled={featureEpics.length > 0} /> : null}
    </div>
  );
}

// L'échéance du projet. Le compte à rebours ne vaut que pendant le
// développement : un projet livré n'est pas « en retard » sur sa date.
function DeadlineStat({ project }: { project: PortalProject }) {
  if (project.group === "CLO") {
    return <Stat label="Échéance" value={project.closedAt ? `Clôturé le ${fmtDate(project.closedAt)}` : "Projet clôturé"} />;
  }
  if (project.deadlineAt) {
    const countdown = project.group === "DEV" ? dueCountdown(daysFromNow(project.deadlineAt)) : null;
    return (
      <Stat label="Échéance" value={fmtDate(project.deadlineAt) ?? "—"}>
        {countdown ? (
          <p className={`mt-1.5 text-xs ${countdown.late ? "font-medium text-red" : "text-muted"}`}>{countdown.text}</p>
        ) : null}
        {project.deadlineNote ? <p className="mt-1 text-xs text-muted">{project.deadlineNote}</p> : null}
      </Stat>
    );
  }
  return <Stat label="Échéance" value={project.deadlineNote ?? "Non fixée"} />;
}

// Garantie et maintenance (CC-351), quand le projet en a.
function CoverageStat({ project }: { project: PortalProject }) {
  const lines = [
    { label: "Garantie", status: coverageStatus(project.warrantyEndsAt) },
    { label: "Maintenance", status: coverageStatus(project.maintenanceEndsAt) },
  ].filter((l) => l.status);
  if (!lines.length) return <Stat label="Garantie et maintenance" value="—" />;
  return (
    <Stat label="Garantie et maintenance" value="">
      <div className="mt-1.5 flex flex-col gap-1">
        {lines.map((l) => (
          <p key={l.label} className={`text-sm ${l.status!.active ? "text-text" : "text-muted"}`}>
            {l.label} <span className="text-xs text-muted">{l.status!.text}</span>
          </p>
        ))}
      </div>
    </Stat>
  );
}

function EpicCard({ epic }: { epic: PortalEpic }) {
  const done = epic.tickets.filter((t) => t.status === "TERMINE").length;
  const total = epic.tickets.length;
  const pct = Math.round((done / total) * 100);
  // Un lot entièrement livré n'a plus d'échéance à surveiller.
  const countdown = epic.dueAt && done < total ? dueCountdown(daysFromNow(epic.dueAt)) : null;

  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">{epic.title}</h3>
          {epic.objective ? <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted">{epic.objective}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          {epic.dueAt ? (
            <span className={countdown?.late ? "font-medium text-red" : "text-muted"}>
              Échéance {fmtDate(epic.dueAt)}{countdown ? ` · ${countdown.text}` : ""}
            </span>
          ) : null}
          <span className="flex items-center gap-2 text-muted">
            <span className="w-24"><Bar pct={pct} className="" /></span>
            {done}/{total} livré{done > 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {epic.tickets.map((t) => <TicketLine key={t.id} ticket={t} withDescription />)}
      </div>
    </div>
  );
}

// Les tickets hors épic : corrections et travaux qui n'entrent dans aucun lot.
// Les livrés sont repliés, sans quoi un projet ancien noierait ce qui est en
// cours sous des dizaines de lignes terminées.
function OthersCard({ tickets, titled }: { tickets: FeatureTicket[]; titled: boolean }) {
  const open = sortOpenTickets(tickets);
  const delivered = tickets.filter((t) => t.status === "TERMINE").sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <h3 className="text-sm font-semibold text-text">{titled ? "Autres travaux" : "Travaux du projet"}</h3>
      <p className="mt-0.5 text-xs text-muted">Corrections et développements{titled ? " hors des lots ci-dessus" : ""}</p>
      <div className="mt-3 flex flex-col gap-2">
        {open.map((t) => <TicketLine key={t.id} ticket={t} />)}
        {open.length === 0 ? <p className="text-sm text-muted">Rien en cours.</p> : null}
      </div>
      {delivered.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-mint">Livrés · {delivered.length}</summary>
          <div className="mt-2 flex flex-col gap-2">
            {delivered.map((t) => <TicketLine key={t.id} ticket={t} />)}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function TicketLine({ ticket: t, withDescription = false }: { ticket: FeatureTicket; withDescription?: boolean }) {
  const countdown = t.dueAt && t.status !== "TERMINE" ? dueCountdown(daysFromNow(t.dueAt)) : null;
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-panel-2 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-text">{t.title}</p>
        {withDescription && t.description ? (
          <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-muted">{t.description}</p>
        ) : null}
        {!withDescription ? <p className="mt-0.5 text-xs text-muted">{TICKET_TYPE_LABEL[t.type]}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CLIENT_STATE_BADGE_CLASS[t.status]}`}>
          {CLIENT_STATE_LABEL[t.status]}
        </span>
        {t.dueAt && t.status !== "TERMINE" ? (
          <span className={`text-[11px] ${countdown?.late ? "font-medium text-red" : "text-muted"}`}>
            {countdown?.late ? "prévu le" : "pour le"} {fmtDate(t.dueAt)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      {value ? <p className="mt-1.5 text-base font-semibold text-text">{value}</p> : null}
      {children}
    </div>
  );
}

function Bar({ pct, className = "mt-2" }: { pct: number; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div className="h-full rounded-full bg-mint" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function MovedColumn({ title, items, color }: { title: string; items: { id: string; title: string }[]; color: string }) {
  return (
    <div>
      <p className={`text-xs font-medium ${color}`}>{title} · {items.length}</p>
      <div className="mt-1.5 flex flex-col gap-1">
        {items.map((i) => <p key={i.id} className="text-sm text-text">{i.title}</p>)}
        {items.length === 0 ? <p className="text-sm text-muted">—</p> : null}
      </div>
    </div>
  );
}
