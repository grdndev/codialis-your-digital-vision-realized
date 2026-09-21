import Link from "next/link";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { MOCKUP_STATUS_BADGE_CLASS, MOCKUP_STATUS_LABEL } from "@/lib/format";
import {
  addApiAction, updateApiAction, deleteApiAction,
  updateUrlAction, deleteUrlAction,
  updateAccountAction, deleteAccountAction,
  updateMockupAction, deleteMockupAction,
  updateCdcDocAction, deleteCdcDocAction,
  updateTechDocAction, deleteTechDocAction,
  updateCustomCategoryAction, deleteCustomCategoryAction,
  updateCustomCategoryRowAction, deleteCustomCategoryRowAction,
  addUrlAction, addAccountAction, addMockupAction,
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
  searchParams: Promise<{ project?: string; tab?: string; edit?: string }>;
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

          <ResourceTabContent projectId={project.id} activeTab={activeTab} team={team} customCategories={customCategories} panel={panel} canUploadCdc={user.role === "PM"} editId={sp.edit} />

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
  editId,
}: {
  projectId: string;
  activeTab: string;
  team: { id: string; name: string }[];
  customCategories: CustomCategoryRow[];
  panel: ResourcePanel | null;
  canUploadCdc: boolean;
  editId?: string;
}) {
  if (activeTab === "api") {
    const apis = panel?.kind === "api" ? panel.apis : [];
    // L'identifiant peut désigner une ligne d'un autre projet ou déjà effacée :
    // on ne reprend que ce qui est bien devant nous.
    const editApi = editId ? apis.find((a) => a.id === editId) : undefined;
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
                <th className="px-4 py-3 font-medium"></th>
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
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/resources?project=${projectId}&tab=api&edit=${a.id}`}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text"
                        >
                          Modifier
                        </Link>
                        <form action={deleteApiAction.bind(null, a.id)}>
                          <button
                            type="submit"
                            className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-red/50 hover:text-red"
                          >
                            Supprimer
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Un seul formulaire pour les deux gestes : `edit` désigne la ligne à
            reprendre, et le champ caché bascule l'action. Ouvert d'office en
            modification, pour ne pas avoir à déplier après avoir cliqué. */}
        <details open={!!editApi}>
          <summary className="cursor-pointer text-xs font-medium text-mint">
            {editApi ? `Modifier · ${editApi.name}` : "+ Ajouter une API"}
          </summary>
          <form
            key={editApi?.id ?? "new"}
            action={editApi ? updateApiAction : addApiAction}
            className="mt-2 grid grid-cols-4 gap-2"
          >
            {editApi ? (
              <input type="hidden" name="apiId" value={editApi.id} />
            ) : (
              <input type="hidden" name="projectId" value={projectId} />
            )}
            <input name="name" placeholder="Nom (Stripe)" required defaultValue={editApi?.name ?? ""} className="input" />
            <input name="role" placeholder="Rôle" defaultValue={editApi?.role ?? ""} className="input" />
            <input name="env" placeholder="Environnement" defaultValue={editApi?.env ?? ""} className="input" />
            <select name="ownerId" defaultValue={editApi?.ownerId ?? ""} className="input"><option value="">Propriétaire</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <input name="baseUrl" placeholder="Base URL" defaultValue={editApi?.baseUrl ?? ""} className="input col-span-2" />
            <input name="maskedKey" placeholder="Clé masquée" defaultValue={editApi?.maskedKey ?? ""} className="input" />
            <input name="authType" placeholder="Type d’auth" defaultValue={editApi?.authType ?? ""} className="input" />
            <input name="expiryNote" placeholder="Expiration" defaultValue={editApi?.expiryNote ?? ""} className="input" />
            <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
              {editApi ? "Enregistrer" : "Ajouter"}
            </button>
            {editApi ? (
              <Link href={`/resources?project=${projectId}&tab=api`} className="self-center text-xs text-muted hover:text-text">
                Annuler
              </Link>
            ) : null}
          </form>
        </details>
      </div>
    );
  }

  if (activeTab === "url") {
    const urls = panel?.kind === "url" ? panel.urls : [];
    const editUrl = editId ? urls.find((u) => u.id === editId) : undefined;
    return (
      <div className="flex flex-col gap-3">
        {urls.length === 0 ? <EmptyState /> : (
          <div className="overflow-x-auto rounded-xl border border-border bg-panel">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Environnement</th><th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">Accès</th><th className="px-4 py-3 font-medium">Dernier déploiement</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {urls.map((u) => (
                  <tr key={u.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-text">{u.env}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{u.url}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{u.access}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{u.deployNote}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <LignesActions
                        modifierHref={`/resources?project=${projectId}&tab=url&edit=${u.id}`}
                        supprimer={deleteUrlAction.bind(null, u.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <details open={!!editUrl}>
          <summary className="cursor-pointer text-xs font-medium text-mint">
            {editUrl ? `Modifier · ${editUrl.env}` : "+ Ajouter une URL"}
          </summary>
          <form key={editUrl?.id ?? "new"} action={editUrl ? updateUrlAction : addUrlAction} className="mt-2 grid grid-cols-4 gap-2">
            {editUrl ? <input type="hidden" name="urlId" value={editUrl.id} /> : <input type="hidden" name="projectId" value={projectId} />}
            <input name="env" placeholder="Environnement" required defaultValue={editUrl?.env ?? ""} className="input" />
            <input name="url" placeholder="URL" defaultValue={editUrl?.url ?? ""} className="input col-span-2" />
            <input name="access" placeholder="Accès" defaultValue={editUrl?.access ?? ""} className="input" />
            <input name="deployNote" placeholder="Dernier déploiement" defaultValue={editUrl?.deployNote ?? ""} className="input" />
            <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
              {editUrl ? "Enregistrer" : "Ajouter"}
            </button>
            {editUrl ? <AnnulerLien href={`/resources?project=${projectId}&tab=url`} /> : null}
          </form>
        </details>
      </div>
    );
  }

  if (activeTab === "acc") {
    const accounts = panel?.kind === "acc" ? panel.accounts : [];
    const editAcc = editId ? accounts.find((a) => a.id === editId) : undefined;
    return (
      <div className="flex flex-col gap-3">
        {accounts.length === 0 ? <EmptyState /> : (
          <div className="overflow-x-auto rounded-xl border border-border bg-panel">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Rôle</th><th className="px-4 py-3 font-medium">Identifiant</th>
                <th className="px-4 py-3 font-medium">Mot de passe</th><th className="px-4 py-3 font-medium">Env.</th><th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-text">{a.role}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{a.login}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{a.passwordMasked}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{a.env}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{a.note}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <LignesActions
                        modifierHref={`/resources?project=${projectId}&tab=acc&edit=${a.id}`}
                        supprimer={deleteAccountAction.bind(null, a.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <details open={!!editAcc}>
          <summary className="cursor-pointer text-xs font-medium text-mint">
            {editAcc ? `Modifier · ${editAcc.role}` : "+ Ajouter un compte"}
          </summary>
          <form key={editAcc?.id ?? "new"} action={editAcc ? updateAccountAction : addAccountAction} className="mt-2 grid grid-cols-5 gap-2">
            {editAcc ? <input type="hidden" name="accountId" value={editAcc.id} /> : <input type="hidden" name="projectId" value={projectId} />}
            <input name="role" placeholder="Rôle" required defaultValue={editAcc?.role ?? ""} className="input" />
            <input name="login" placeholder="Identifiant" defaultValue={editAcc?.login ?? ""} className="input" />
            <input name="passwordMasked" placeholder="Mot de passe" defaultValue={editAcc?.passwordMasked ?? ""} className="input" />
            <input name="env" placeholder="Environnement" defaultValue={editAcc?.env ?? ""} className="input" />
            <input name="note" placeholder="Note" defaultValue={editAcc?.note ?? ""} className="input" />
            <button type="submit" className="col-span-4 rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
              {editAcc ? "Enregistrer" : "Ajouter"}
            </button>
            {editAcc ? <AnnulerLien href={`/resources?project=${projectId}&tab=acc`} /> : null}
          </form>
        </details>
      </div>
    );
  }

  if (activeTab === "mock") {
    const mockups = panel?.kind === "mock" ? panel.mockups : [];
    const sources = panel?.kind === "mock" ? panel.sources : [];
    const editMock = editId ? mockups.find((m) => m.id === editId) : undefined;
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
                <div className="mt-3 border-t border-border pt-2">
                  <LignesActions
                    modifierHref={`/resources?project=${projectId}&tab=mock&edit=${m.id}`}
                    supprimer={deleteMockupAction.bind(null, m.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <details open={!!editMock}>
          <summary className="cursor-pointer text-xs font-medium text-mint">
            {editMock ? `Modifier · ${editMock.name}` : "+ Ajouter un écran"}
          </summary>
          <form key={editMock?.id ?? "new"} action={editMock ? updateMockupAction : addMockupAction} className="mt-2 grid grid-cols-4 gap-2">
            {editMock ? <input type="hidden" name="mockupId" value={editMock.id} /> : <input type="hidden" name="projectId" value={projectId} />}
            <input name="name" placeholder="Nom de l’écran" required defaultValue={editMock?.name ?? ""} className="input" />
            <input name="version" placeholder="Version / note" defaultValue={editMock?.version ?? ""} className="input" />
            <select name="status" defaultValue={editMock?.status ?? "BROUILLON"} className="input">
              <option value="BROUILLON">Brouillon</option><option value="A_VALIDER">À valider</option>
              <option value="EN_INTEGRATION">En intégration</option><option value="VALIDE">Validé</option>
            </select>
            <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
              {editMock ? "Enregistrer" : "Ajouter"}
            </button>
            {editMock ? <AnnulerLien href={`/resources?project=${projectId}&tab=mock`} /> : null}
          </form>
        </details>
      </div>
    );
  }

  if (activeTab === "doc") {
    const cdc = panel?.kind === "doc" ? panel.cdc : [];
    const techDocs = panel?.kind === "doc" ? panel.techDocs : [];
    const editCdc = editId ? cdc.find((c) => c.id === editId) : undefined;
    const editTech = editId ? techDocs.find((t) => t.id === editId) : undefined;
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
                {canUploadCdc ? (
                  <div className="mt-2 border-t border-border pt-2">
                    <LignesActions
                      modifierHref={`/resources?project=${projectId}&tab=doc&edit=${c.id}`}
                      supprimer={deleteCdcDocAction.bind(null, c.id)}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {canUploadCdc ? (
            <details className="mt-3" open={!!editCdc}>
              <summary className="cursor-pointer text-xs font-medium text-mint">
                {editCdc ? `Modifier · ${editCdc.name}` : "+ Déposer un document"}
              </summary>
              <form key={editCdc?.id ?? "new"} action={editCdc ? updateCdcDocAction : addCdcDocAction} className="mt-2 flex flex-col gap-2">
                {editCdc ? <input type="hidden" name="docId" value={editCdc.id} /> : <input type="hidden" name="projectId" value={projectId} />}
                <input name="name" placeholder="Nom du document" required defaultValue={editCdc?.name ?? ""} className="input" />
                <input name="version" placeholder="Version" defaultValue={editCdc?.version ?? ""} className="input" />
                <input name="meta" placeholder="Note (pages, date…)" defaultValue={editCdc?.meta ?? ""} className="input" />
                <input name="status" placeholder="Statut" defaultValue={editCdc?.status ?? "En vigueur"} className="input" />
                <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
                  {editCdc ? "Enregistrer" : "Déposer"}
                </button>
                {editCdc ? <AnnulerLien href={`/resources?project=${projectId}&tab=doc`} /> : null}
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
                <div className="mt-2 border-t border-border pt-2">
                  <LignesActions
                    modifierHref={`/resources?project=${projectId}&tab=doc&edit=${t.id}`}
                    supprimer={deleteTechDocAction.bind(null, t.id)}
                  />
                </div>
              </div>
            ))}
          </div>
          <details className="mt-3" open={!!editTech}>
            <summary className="cursor-pointer text-xs font-medium text-mint">
              {editTech ? `Modifier · ${editTech.name}` : "+ Ajouter un document"}
            </summary>
            <form key={editTech?.id ?? "new"} action={editTech ? updateTechDocAction : addTechDocAction} className="mt-2 flex flex-col gap-2">
              {editTech ? <input type="hidden" name="docId" value={editTech.id} /> : <input type="hidden" name="projectId" value={projectId} />}
              <input name="name" placeholder="Nom du document" required defaultValue={editTech?.name ?? ""} className="input" />
              <input name="ext" placeholder="Extension" defaultValue={editTech?.ext ?? ""} className="input" />
              <input name="meta" placeholder="Note" defaultValue={editTech?.meta ?? ""} className="input" />
              <input name="status" placeholder="Statut" defaultValue={editTech?.status ?? "À jour"} className="input" />
              <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
                {editTech ? "Enregistrer" : "Ajouter"}
              </button>
              {editTech ? <AnnulerLien href={`/resources?project=${projectId}&tab=doc`} /> : null}
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
    const editRow = editId ? category.rows.find((r) => r.id === editId) : undefined;
    const editCategorie = editId === category.id;
    return (
      <div className="rounded-xl border border-border bg-panel p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-text">{category.name}</h3>
            <p className="mt-0.5 text-xs text-muted">{category.visibility === "PM_ONLY" ? "visible chef de projet uniquement" : "visible équipe"}</p>
          </div>
          {/* Supprimer la catégorie emporte ses lignes : c'est la table
              entière qui disparaît, pas seulement son en-tête. */}
          <LignesActions
            modifierHref={`/resources?project=${projectId}&tab=${activeTab}&edit=${category.id}`}
            supprimer={deleteCustomCategoryAction.bind(null, category.id)}
          />
        </div>
        {editCategorie ? (
          <form action={updateCustomCategoryAction} className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3">
            <input type="hidden" name="categoryId" value={category.id} />
            <input name="name" defaultValue={category.name} required className="input col-span-2" />
            <select name="visibility" defaultValue={category.visibility} className="input">
              <option value="TEAM">Équipe</option>
              <option value="PM_ONLY">Chef de projet seul</option>
            </select>
            <select name="format" defaultValue={category.format} className="input">
              <option value="TABLE">Tableau</option>
              <option value="FILES">Liste de fichiers</option>
              <option value="NOTES">Notes libres</option>
            </select>
            <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">Enregistrer</button>
            <AnnulerLien href={`/resources?project=${projectId}&tab=${activeTab}`} />
          </form>
        ) : null}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[500px] border-collapse text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted">
              {columns.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}
              <th className="px-3 py-2 font-medium"></th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {category.rows.map((r) => {
                const values: string[] = JSON.parse(r.data);
                return (
                  <tr key={r.id}>
                    {values.map((v, i) => <td key={i} className="whitespace-nowrap px-3 py-2 text-muted">{v}</td>)}
                    <td className="whitespace-nowrap px-3 py-2">
                      <LignesActions
                        modifierHref={`/resources?project=${projectId}&tab=${activeTab}&edit=${r.id}`}
                        supprimer={deleteCustomCategoryRowAction.bind(null, r.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <details className="mt-3" open={!!editRow}>
          <summary className="cursor-pointer text-xs font-medium text-mint">
            {editRow ? "Modifier la ligne" : "+ Ajouter une ligne"}
          </summary>
          <form
            key={editRow?.id ?? "new"}
            action={editRow ? updateCustomCategoryRowAction : addCustomCategoryRowAction}
            className="mt-2 flex flex-wrap gap-2"
          >
            {editRow ? (
              <input type="hidden" name="rowId" value={editRow.id} />
            ) : (
              <input type="hidden" name="categoryId" value={category.id} />
            )}
            {columns.map((c, i) => (
              <input
                key={i}
                name={`col_${i}`}
                placeholder={c}
                defaultValue={editRow ? ((JSON.parse(editRow.data) as string[])[i] ?? "") : ""}
                className="input w-40"
              />
            ))}
            <button type="submit" className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-bg">
              {editRow ? "Enregistrer" : "Ajouter"}
            </button>
            {editRow ? <AnnulerLien href={`/resources?project=${projectId}&tab=${activeTab}`} /> : null}
          </form>
        </details>
      </div>
    );
  }

  return null;
}

// Les deux gestes de reprise, identiques d'un type de ressource à l'autre :
// un lien qui ouvre le formulaire sur la ligne, un bouton qui la retire.
function LignesActions({
  modifierHref,
  supprimer,
}: {
  modifierHref: string;
  supprimer: () => void | Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={modifierHref}
        className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text"
      >
        Modifier
      </Link>
      <form action={supprimer}>
        <button
          type="submit"
          className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-red/50 hover:text-red"
        >
          Supprimer
        </button>
      </form>
    </div>
  );
}

function AnnulerLien({ href }: { href: string }) {
  return (
    <Link href={href} className="self-center text-xs text-muted hover:text-text">
      Annuler
    </Link>
  );
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
