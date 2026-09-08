import { requireClientProject } from "@/lib/client-project";
import { CLIENT_NAV_ITEMS } from "@/lib/nav";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, project } = await requireClientProject();
  const items = CLIENT_NAV_ITEMS.map((i) => ({ ...i, roles: ["CLIENT" as const] }));

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar items={items} title={project.client.name} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
