import Link from "next/link";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import type { ActionItemRow, ProjectWithClient } from "@/lib/dto";
import { createActionItemAction, toggleActionItemAction } from "./actions";
import { projectLabel } from "@/lib/format";

const GROUPS: { category: "URGENT" | "RELANCE" | "DECISION"; title: string; note: string; color: string; border: string }[] = [
  { category: "URGENT", title: "Urgent", note: "échéance dépassée ou risque immédiat", color: "text-red", border: "border-red/30 bg-red/5" },
  { category: "RELANCE", title: "Relances commerciales", note: "cette semaine", color: "text-amber", border: "border-border bg-panel-2" },
  { category: "DECISION", title: "Décisions et validations", note: "en attente de vous", color: "text-blue", border: "border-border bg-panel-2" },
];

export default async function TodoPage() {
  await requireRole("DIR");

  const { items, projects } = await apiGet<{
    items: ActionItemRow[];
    projects: ProjectWithClient[];
  }>("/api/admin/todo", "/dashboard");
  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const urgentOpen = open.filter((i) => i.category === "URGENT");
  const amountTotal = open.reduce((s, i) => {
    const n = parseFloat(i.amountLabel.replace(/[^\d,.-]/g, "").replace(",", "."));
    return s + (Number.isFinite(n) ? Math.abs(n) : 0);
  }, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">À traiter</h1>
        <p className="mt-1 text-sm text-muted">
          {urgentOpen.length} urgences · {open.length - urgentOpen.length} relances/décisions · {done.length} traité(s)
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Urgent" value={String(urgentOpen.length)} note="échéance dépassée" color="text-red" />
        <Kpi label="À traiter" value={String(open.length)} note="relances et décisions" color="text-amber" />
        <Kpi label="En jeu" value={`${Math.round(amountTotal / 1000)} k€`} note="factures + affaires à relancer" />
        <Kpi label="Traité" value={String(done.length)} note={`${open.length} restant(s)`} color="text-mint" />
      </div>

      {GROUPS.map((g) => {
        const groupItems = open.filter((i) => i.category === g.category);
        if (groupItems.length === 0) return null;
        return (
          <div key={g.category} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <h2 className={`text-sm font-semibold ${g.color}`}>{g.title}</h2>
              <span className="text-xs text-muted">{g.note}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {groupItems.map((item) => (
                <div key={item.id} className={`flex flex-col gap-2 rounded-xl border p-4 ${g.border}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted">{item.tag}</span>
                    <span className={`text-xs font-medium ${g.color}`}>{item.dueLabel}</span>
                  </div>
                  <p className="text-sm font-medium text-text">
                    {item.linkedProject ? <Link href={`/projects/${item.linkedProject.id}`} className="hover:text-mint">{item.title}</Link> : item.title}
                  </p>
                  <p className="text-xs text-muted">{item.detail}</p>
                  <div className="mt-1 flex items-center justify-between">
                    {item.amountLabel ? <span className="text-sm text-text">{item.amountLabel}</span> : <span />}
                    <form action={toggleActionItemAction.bind(null, item.id)}>
                      <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">{item.ctaLabel}</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Nouvelle action</h2>
        <p className="mt-1 text-xs text-muted">
          Ce que vous devez traiter et qui ne découle d’aucun écran : une relance, un
          arbitrage, un point à ne pas oublier.
        </p>
        <form action={createActionItemAction} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <TodoField label="Catégorie">
              <select name="category" defaultValue="URGENT" className="input">
                {GROUPS.map((g) => (
                  <option key={g.category} value={g.category}>
                    {g.title}
                  </option>
                ))}
              </select>
            </TodoField>
            <TodoField label="Intitulé">
              <input name="title" required className="input" />
            </TodoField>
            <TodoField label="Étiquette" hint="facultatif">
              <input name="tag" className="input" />
            </TodoField>
          </div>
          <TodoField label="Détail" hint="facultatif">
            <input name="detail" className="input" />
          </TodoField>
          <div className="grid grid-cols-3 gap-3">
            <TodoField label="Échéance affichée" hint="texte libre">
              <input name="dueLabel" placeholder="cette semaine" className="input" />
            </TodoField>
            <TodoField label="Montant affiché" hint="facultatif">
              <input name="amountLabel" placeholder="1 200 €" className="input" />
            </TodoField>
            <TodoField label="Projet lié" hint="facultatif">
              <select name="linkedProjectId" defaultValue="" className="input">
                <option value="">Aucun</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {projectLabel(p.client.name, p.name)}
                  </option>
                ))}
              </select>
            </TodoField>
          </div>
          <button
            type="submit"
            className="mt-1 self-start rounded-lg bg-mint px-4 py-2 text-xs font-semibold text-bg transition hover:brightness-110"
          >
            Ajouter à traiter
          </button>
        </form>
      </div>

      {done.length > 0 ? (
        <details className="rounded-xl border border-border bg-panel p-4">
          <summary className="cursor-pointer text-sm font-medium text-muted">{done.length} traité(s)</summary>
          <div className="mt-3 flex flex-col gap-2">
            {done.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-muted line-through">{item.title}</span>
                <form action={toggleActionItemAction.bind(null, item.id)}>
                  <button type="submit" className="text-xs text-muted hover:text-text">Rouvrir</button>
                </form>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function TodoField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">
        {label}
        {hint ? <span className="ml-1 text-[10px] text-muted/70">({hint})</span> : null}
      </label>
      {children}
    </div>
  );
}

function Kpi({ label, value, note, color }: { label: string; value: string; note: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${color ?? "text-text"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
