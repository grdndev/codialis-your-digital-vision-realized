import { apiGet } from "@/lib/api";
import { portalQuery, requireClientProject } from "@/lib/client-project";
import { CLIENT_STATE_LABEL, CLIENT_STATE_BADGE_CLASS } from "@/lib/features";
import type { PortalCdcDocRow, PortalEpic, PortalProjectScreen } from "../types";

// « Devis » est retiré (CC-374) : aucun écran de l'agence ne remplit les devis,
// l'onglet affichait toujours « Aucun devis ». Une ancienne adresse
// `?tab=devis` retombe sur les fonctionnalités.
const TABS = [
  { id: "features", label: "Fonctionnalités prévues" },
  { id: "cdc", label: "Cahier des charges" },
];

export default async function PortalProjectPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { project } = await requireClientProject();
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.tab) ? sp.tab! : "features";

  // Un seul volet est chargé : les deux n'ont aucune donnée en commun.
  const { epics, docs } = await apiGet<PortalProjectScreen>(
    `/api/admin/client/project?tab=${tab}&${portalQuery(project)}`,
    "/portal",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Mon projet</h1>
        <p className="mt-1 text-sm text-muted">{project.name} · fonctionnalités et cahier des charges</p>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-panel p-1 text-sm">
        {TABS.map((t) => (
          <a key={t.id} href={`/portal/project?tab=${t.id}`} className={`rounded-md px-3 py-1.5 ${tab === t.id ? "bg-mint/10 text-mint" : "text-muted"}`}>
            {t.label}
          </a>
        ))}
      </div>

      {tab === "features" ? <FeaturesTab epics={epics} /> : null}
      {tab === "cdc" ? <CdcTab docs={docs} /> : null}
    </div>
  );
}

function FeaturesTab({ epics }: { epics: PortalEpic[] }) {
  const featureEpics = epics.filter((e) => e.tickets.length > 0);
  if (featureEpics.length === 0) return <EmptyState text="Le détail des fonctionnalités n’est pas encore disponible." />;

  return (
    <div className="flex flex-col gap-3">
      {featureEpics.map((epic) => (
        <div key={epic.id} className="rounded-xl border border-border bg-panel p-5">
          <h3 className="text-sm font-semibold text-text">{epic.title}</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {epic.tickets.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
                <span className="truncate text-text">{t.title}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CLIENT_STATE_BADGE_CLASS[t.status]}`}>
                  {CLIENT_STATE_LABEL[t.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CdcTab({ docs }: { docs: PortalCdcDocRow[] }) {
  if (docs.length === 0) return <EmptyState text="Le cahier des charges n’a pas encore été déposé." />;
  const main = docs.find((d) => d.sections && d.sections !== "[]");
  const sections: { n: string; title: string; body: string }[] = main ? JSON.parse(main.sections) : [];

  return (
    <div className="flex flex-col gap-4">
      {sections.length > 0 ? (
        <div className="rounded-xl border border-border bg-panel p-5">
          <h2 className="text-sm font-semibold text-text">{main!.name}</h2>
          <p className="text-xs text-muted">{main!.version} · {main!.meta}</p>
          <div className="mt-4 flex flex-col gap-4">
            {sections.map((s) => (
              <div key={s.n}>
                <p className="text-sm font-medium text-text">{s.n}. {s.title}</p>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">Documents</h2>
        <div className="mt-3 flex flex-col gap-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
              <span className="text-text">{d.name}</span>
              <span className="text-xs text-muted">{d.meta} · {d.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-border bg-panel px-5 py-6 text-sm text-muted">{text}</p>;
}
