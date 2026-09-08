import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import type { ProjectsScreen } from "./types";
import { fmtHours, daysFromNow, GROUP_BADGE_CLASS, GROUP_LABEL } from "@/lib/format";
import type { ProjectGroup } from "@/lib/types";

const PHASES: { id: "all" | ProjectGroup; label: string }[] = [
  { id: "all", label: "Tous les projets" },
  { id: "DEV", label: "En développement" },
  { id: "FIN", label: "Terminés" },
  { id: "WAR", label: "Sous garantie" },
  { id: "MAI", label: "En maintenance" },
  { id: "CLO", label: "Clôturés" },
];

function deadlineDisplay(p: {
  group: ProjectGroup;
  closedAt: Date | null;
  deadlineAt: Date | null;
  deadlineNote: string | null;
}) {
  if (p.group === "CLO") {
    return { text: p.closedAt ? `clôturé ${fmt(p.closedAt)}` : "—", color: "text-muted" };
  }
  if (p.deadlineAt) {
    const days = daysFromNow(p.deadlineAt);
    const color = days <= 5 ? "text-red" : days <= 12 ? "text-amber" : "text-muted";
    const text = days < 0 ? `${fmt(p.deadlineAt)} · échu` : `${fmt(p.deadlineAt)} · ${days} j`;
    return { text, color };
  }
  return { text: p.deadlineNote ?? "—", color: "text-muted" };
}

function fmt(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(d);
}

function relativeActivity(d: Date) {
  const days = -daysFromNow(d);
  if (days <= 0) return "aujourd’hui";
  if (days === 1) return "hier";
  return `il y a ${days} j`;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ phase?: string }>;
}) {
  await requireRole("DIR", "PM");
  const { phase } = await searchParams;
  const active: ProjectGroup | "all" = (phase as ProjectGroup | undefined) ?? "all";

  const { allProjects } = await apiGet<ProjectsScreen>("/api/admin/projects");
  const clientCount = new Set(allProjects.map((p) => p.clientId)).size;

  const counts: Record<string, number> = { all: allProjects.length };
  for (const g of ["DEV", "FIN", "WAR", "MAI", "CLO"] as ProjectGroup[]) {
    counts[g] = allProjects.filter((p) => p.group === g).length;
  }

  const filtered = active === "all" ? allProjects : allProjects.filter((p) => p.group === active);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Tous les projets</h1>
          <p className="mt-1 text-sm text-muted">
            {allProjects.length} projets · {clientCount} clients
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        {PHASES.map((ph) => (
          <Link
            key={ph.id}
            href={ph.id === "all" ? "/projects" : `/projects?phase=${ph.id}`}
            className={`rounded-xl border px-4 py-3 text-sm transition ${
              active === ph.id
                ? "border-mint/40 bg-mint/10 text-text"
                : "border-border bg-panel text-muted hover:text-text"
            }`}
          >
            <div className="font-medium">{ph.label}</div>
            <div className="mt-0.5 text-xs text-muted">{counts[ph.id] ?? 0} projets</div>
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-panel">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-5 py-3 font-medium">Client — projet</th>
              <th className="px-5 py-3 font-medium">Phase</th>
              <th className="px-5 py-3 font-medium">Heures</th>
              <th className="px-5 py-3 font-medium">Avancement</th>
              <th className="px-5 py-3 font-medium">Échéance</th>
              <th className="px-5 py-3 font-medium">Activité</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((p) => {
              const dl = deadlineDisplay(p);
              return (
                <tr key={p.id} className="transition hover:bg-panel-2">
                  <td className="px-5 py-3">
                    <Link href={`/projects/${p.id}`} className="block">
                      <p className="font-medium text-text">
                        {p.client.name} — {p.name}
                      </p>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GROUP_BADGE_CLASS[p.group]}`}>
                      {p.phaseLabel || GROUP_LABEL[p.group]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted">
                    {fmtHours(p.hoursSpent)} / {fmtHours(p.hoursSold)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${p.hoursSpent > p.hoursSold ? "bg-amber" : "bg-mint"}`}
                          style={{ width: `${Math.min(100, p.progressPct)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted">{p.progressPct}%</span>
                    </div>
                  </td>
                  <td className={`whitespace-nowrap px-5 py-3 ${dl.color}`}>{dl.text}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted">{relativeActivity(p.lastActivityAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
