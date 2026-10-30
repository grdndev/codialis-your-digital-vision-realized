import { requireClientProject } from "@/lib/client-project";
import { CLIENT_NAV_ITEMS } from "@/lib/nav";
import { GROUP_LABEL } from "@/lib/format";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { selectPortalProjectAction } from "./portal/actions";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, project, projects } = await requireClientProject();
  const items = CLIENT_NAV_ITEMS.map((i) => ({ ...i, roles: ["CLIENT" as const] }));

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar items={items} title={project.client.name} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {/* Une entreprise peut avoir plusieurs projets chez l'agence
              (CC-374) : le choix vaut pour tous les écrans du portail. */}
          {projects.length > 1 ? (
            <div className="mb-6 flex flex-wrap items-center gap-2" aria-label="Vos projets">
              <span className="text-xs text-muted">Vos projets</span>
              {projects.map((p) => (
                <form key={p.id} action={selectPortalProjectAction}>
                  <input type="hidden" name="projectId" value={p.id} />
                  <button
                    type="submit"
                    aria-pressed={p.id === project.id}
                    title={GROUP_LABEL[p.group]}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      p.id === project.id
                        ? "border-mint/40 bg-mint/10 text-text"
                        : "border-border text-muted hover:text-text"
                    } ${p.group === "CLO" && p.id !== project.id ? "opacity-60" : ""}`}
                  >
                    {p.name}
                  </button>
                </form>
              ))}
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
