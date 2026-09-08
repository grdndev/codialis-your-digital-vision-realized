import Link from "next/link";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { MOCKUP_STATUS_BADGE_CLASS, MOCKUP_STATUS_LABEL } from "@/lib/format";
import {
  addApiAction, addUrlAction, addAccountAction, addMockupAction,
  addCdcDocAction, addTechDocAction, addCustomCategoryAction, addCustomCategoryRowAction,
} from "./actions";
import type { CustomCategoryRow, ResourcePanel, ResourcesScreen } from "./types";

const BASE_TABS = [
  { id: "api", label: "APIs & clés" },
  { id: "url", label: "URLs & accès" },
  { id: "acc", label: "Comptes de test" },
  { id: "mock", label: "Maquettes" },
  { id: "doc", label: "Cahier des charges" },
];

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; tab?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  // Le projet et l'onglet actifs sont résolus par l'API, qui ne charge que
  // les ressources de l'onglet retenu — un seul aller-retour au lieu de deux.
  const query = new URLSearchParams();
  if (sp.project) query.set("project", sp.project);
  if (sp.tab) query.set("tab", sp.tab);
  const { projects, activeProjectId, activeTab, customCategories, team, panel } =
    await apiGet<ResourcesScreen>(`/api/admin/resources?${query}`);

  const project = projects.find((p) => p.id === activeProjectId);
  const tabs = [...BASE_TABS, ...customCategories.map((c) => ({ id: `custom:${c.id}`, label: c.name }))];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Ressources projet</h1>
        <p className="mt-1 text-sm text-muted">APIs, URLs, comptes de test, maquettes, cahier des charges</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/resources?project=${p.id}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              activeProjectId === p.id ? "border-mint/40 bg-mint/10 text-text" : "border-border text-muted hover:text-text"
            }`}
          >
            {p.client.name}
          </Link>
        ))}
      </div>

      {!project ? (
        <p className="rounded-xl border border-border bg-panel px-5 py-6 text-sm text-muted">Aucun projet disponible.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-panel p-1 text-sm">
            {tabs.map((t) => (
              <Link
                key={t.id}
                href={`/resources?project=${project.id}&tab=${t.id}`}
                className={`rounded-md px-3 py-1.5 ${
                  activeTab === t.id ? "bg-mint/10 text-mint" : t.id.startsWith("custom:") ? "text-blue" : "text-muted"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>

          <ResourceTabContent projectId={project.id} activeTab={activeTab} team={team} customCategories={customCategories} panel={panel} canUploadCdc={user.role === "PM"} />

          <NewCategoryForm projectId={project.id} />
        </>
      )}
    </div>
  );
}

async function ResourceTabContent({
  projectId,
  activeTab,
  team,
  customCategories,
  panel,
  canUploadCdc,
}: {
  projectId: string;
  activeTab: string;
  team: { id: string; name: string }[];
  customCategories: CustomCategoryRow[];
  panel: ResourcePanel | null;
  canUploadCdc: boolean;
}) {
  if (activeTab === "api") {
    const apis = panel?.kind === "api" ? panel.apis : [];
    return (
      <div className="flex flex-col gap-3">
        {apis.length === 0 ? <EmptyState /> : (
          <div className="overflow-x-auto rounded-xl border border-border bg-panel">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Service</th><th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Env.</th><th className="px-4 py-3 font-medium">Base URL</th>
                <th className="px-4 py-3 font-medium">Clé</th><th className="px-4 py-3 font-medium">Auth</th>
                <th className="px-4 py-3 font-medium">Propriétaire</th><th className="px-4 py-3 font-medium">Expiration</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {apis.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-text">{a.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{a.role}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{a.env}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{a.baseUrl}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{a.maskedKey}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{a.authType}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{a.owner?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{a.expiryNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <details><summary className="cursor-pointer text-xs font-medium text-mint">+ Ajouter une API</summary>
          <form action={addApiAction} className="mt-2 grid grid-cols-4 gap-2">
            <input type="hidden" name="projectId" value={projectId} />
            <input name="name" placeholder="Nom (Stripe)" required className="input" />
            <input name="role" placeholder="Rôle" className="input" />
            <input name="env" placeholder="Environnement" className="input" />
            <select name="ownerId" className="input"><option value="">Propriétaire</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <input name="baseUrl" placeholder="Base URL" className="input col-span-2" />
            <input name="maskedKey" placeholder="Clé masquée" className="input" />
            <input name="authType" placeholder="Type d’auth" className="input" />
            <input name="expiryNote" placeholder="Expiration" className="input" />
            <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Ajouter</button>
          </form>
        </details>
      </div>
    );
  }

  if (activeTab === "url") {
    const urls = panel?.kind === "url" ? panel.urls : [];
    return (
      <div className="flex flex-col gap-3">
        {urls.length === 0 ? <EmptyState /> : (
          <div className="overflow-x-auto rounded-xl border border-border bg-panel">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Environnement</th><th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">Accès</th><th className="px-4 py-3 font-medium">Dernier déploiement</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {urls.map((u) => (
                  <tr key={u.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-text">{u.env}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{u.url}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{u.access}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{u.deployNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <details><summary className="cursor-pointer text-xs font-medium text-mint">+ Ajouter une URL</summary>
          <form action={addUrlAction} className="mt-2 grid grid-cols-4 gap-2">
            <input type="hidden" name="projectId" value={projectId} />
            <input name="env" placeholder="Environnement" required className="input" />
            <input name="url" placeholder="URL" className="input col-span-2" />
            <input name="access" placeholder="Accès" className="input" />
            <input name="deployNote" placeholder="Dernier déploiement" className="input" />
            <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Ajouter</button>
          </form>
        </details>
      </div>
    );
  }

  if (activeTab === "acc") {
    const accounts = panel?.kind === "acc" ? panel.accounts : [];
    return (
      <div className="flex flex-col gap-3">
        {accounts.length === 0 ? <EmptyState /> : (
          <div className="overflow-x-auto rounded-xl border border-border bg-panel">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Rôle</th><th className="px-4 py-3 font-medium">Identifiant</th>
                <th className="px-4 py-3 font-medium">Mot de passe</th><th className="px-4 py-3 font-medium">Env.</th><th className="px-4 py-3 font-medium">Note</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-text">{a.role}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{a.login}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{a.passwordMasked}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{a.env}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{a.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <details><summary className="cursor-pointer text-xs font-medium text-mint">+ Ajouter un compte</summary>
          <form action={addAccountAction} className="mt-2 grid grid-cols-5 gap-2">
            <input type="hidden" name="projectId" value={projectId} />
            <input name="role" placeholder="Rôle" required className="input" />
            <input name="login" placeholder="Identifiant" className="input" />
            <input name="passwordMasked" placeholder="Mot de passe" className="input" />
            <input name="env" placeholder="Environnement" className="input" />
            <input name="note" placeholder="Note" className="input" />
            <button type="submit" className="col-span-5 rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Ajouter</button>
          </form>
        </details>
      </div>
    );
  }

  if (activeTab === "mock") {
    const mockups = panel?.kind === "mock" ? panel.mockups : [];
    const sources = panel?.kind === "mock" ? panel.sources : [];
    return (
      <div className="flex flex-col gap-4">
        {sources.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="rounded-lg border border-border bg-panel px-3 py-2 text-xs text-muted hover:text-text">
                {s.label} · <span className="text-mint">{s.status}</span>
              </a>
            ))}
          </div>
        ) : null}
        {mockups.length === 0 ? <EmptyState /> : (
          <div className="grid grid-cols-3 gap-3">
            {mockups.map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-panel p-4">
                <div className="mb-2 h-24 rounded-lg bg-panel-2" />
                <p className="text-sm font-medium text-text">{m.name}</p>
                <p className="mt-0.5 text-xs text-muted">{m.version}</p>
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${MOCKUP_STATUS_BADGE_CLASS[m.status]}`}>
                  {MOCKUP_STATUS_LABEL[m.status]}
                </span>
              </div>
            ))}
          </div>
        )}
        <details><summary className="cursor-pointer text-xs font-medium text-mint">+ Ajouter un écran</summary>
          <form action={addMockupAction} className="mt-2 grid grid-cols-4 gap-2">
            <input type="hidden" name="projectId" value={projectId} />
            <input name="name" placeholder="Nom de l’écran" required className="input" />
            <input name="version" placeholder="Version / note" className="input" />
            <select name="status" className="input">
              <option value="BROUILLON">Brouillon</option><option value="A_VALIDER">À valider</option>
              <option value="EN_INTEGRATION">En intégration</option><option value="VALIDE">Validé</option>
            </select>
            <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Ajouter</button>
          </form>
        </details>
      </div>
    );
  }

  if (activeTab === "doc") {
    const cdc = panel?.kind === "doc" ? panel.cdc : [];
    const techDocs = panel?.kind === "doc" ? panel.techDocs : [];
    return (
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-panel p-5">
          <h3 className="text-sm font-semibold text-text">Cahier des charges</h3>
          <div className="mt-3 flex flex-col gap-2">
            {cdc.length === 0 ? <EmptyState /> : cdc.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text">{c.name}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted">{c.status}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">{c.meta}</p>
              </div>
            ))}
          </div>
          {canUploadCdc ? (
            <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-mint">+ Déposer un document</summary>
              <form action={addCdcDocAction} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="projectId" value={projectId} />
                <input name="name" placeholder="Nom du document" required className="input" />
                <input name="version" placeholder="Version" className="input" />
                <input name="meta" placeholder="Note (pages, date…)" className="input" />
                <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Déposer</button>
              </form>
            </details>
          ) : (
            <p className="mt-3 text-xs text-muted">déposé par la cheffe de projet</p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-panel p-5">
          <h3 className="text-sm font-semibold text-text">Documents techniques</h3>
          <div className="mt-3 flex flex-col gap-2">
            {techDocs.length === 0 ? <EmptyState /> : techDocs.map((t) => (
              <div key={t.id} className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text">{t.name}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted">{t.status}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">{t.ext} · {t.meta}</p>
              </div>
            ))}
          </div>
          <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-mint">+ Ajouter un document</summary>
            <form action={addTechDocAction} className="mt-2 flex flex-col gap-2">
              <input type="hidden" name="projectId" value={projectId} />
              <input name="name" placeholder="Nom du document" required className="input" />
              <input name="ext" placeholder="Extension" className="input" />
              <input name="meta" placeholder="Note" className="input" />
              <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Ajouter</button>
            </form>
          </details>
        </div>
      </div>
    );
  }

  if (activeTab.startsWith("custom:")) {
    const catId = activeTab.slice("custom:".length);
    const category = customCategories.find((c) => c.id === catId);
    if (!category) return <EmptyState />;
    const columns: string[] = JSON.parse(category.columns);
    return (
      <div className="rounded-xl border border-border bg-panel p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text">{category.name}</h3>
            <p className="mt-0.5 text-xs text-muted">{category.visibility === "PM_ONLY" ? "visible chef de projet uniquement" : "visible équipe"}</p>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[500px] border-collapse text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted">
              {columns.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-border">
              {category.rows.map((r) => {
                const values: string[] = JSON.parse(r.data);
                return (
                  <tr key={r.id}>
                    {values.map((v, i) => <td key={i} className="whitespace-nowrap px-3 py-2 text-muted">{v}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-mint">+ Ajouter une ligne</summary>
          <form action={addCustomCategoryRowAction} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="categoryId" value={category.id} />
            {columns.map((c, i) => (
              <input key={i} name={`col_${i}`} placeholder={c} className="input w-40" />
            ))}
            <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Ajouter</button>
          </form>
        </details>
      </div>
    );
  }

  return null;
}

function EmptyState() {
  return <p className="rounded-xl border border-border bg-panel px-5 py-6 text-sm text-muted">Ressources non renseignées sur ce projet.</p>;
}

function NewCategoryForm({ projectId }: { projectId: string }) {
  return (
    <details className="rounded-xl border border-border bg-panel p-4">
      <summary className="cursor-pointer text-sm font-medium text-blue">+ Catégorie</summary>
      <form action={addCustomCategoryAction} className="mt-3 grid grid-cols-4 gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input name="name" placeholder="Nom de la catégorie" required className="input col-span-2" />
        <select name="visibility" className="input"><option value="TEAM">Équipe</option><option value="PM_ONLY">Chef de projet seul</option></select>
        <select name="format" className="input"><option value="TABLE">Tableau</option><option value="FILES">Liste de fichiers</option><option value="NOTES">Notes libres</option></select>
        <input name="columns" placeholder="Colonnes séparées par une virgule" className="input col-span-3" />
        <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Créer</button>
      </form>
    </details>
  );
}
