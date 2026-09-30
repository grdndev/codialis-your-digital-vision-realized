import { getCurrentTheme, requireUser } from "@/lib/auth";
import { themeCss } from "@/lib/theme";
import { NAV_ITEMS } from "@/lib/nav";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  // Les couleurs personnelles redéfinissent les variables de globals.css pour
  // toute la page : fond, panneaux et accent suivent sans rien recompiler.
  const css = themeCss(await getCurrentTheme());

  return (
    <div className="flex min-h-screen w-full">
      {css ? <style>{css}</style> : null}
      <Sidebar items={items} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
