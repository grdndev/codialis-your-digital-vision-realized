import Link from "next/link";
import type { Role } from "@/lib/types";

// Rentabilité et Temps sont présentés comme un seul écran à deux onglets, alors
// qu'ils restent deux routes. Ce sélecteur, posé en tête des deux pages, fait le
// lien. Un développeur n'a pas accès à la rentabilité : il ne voit qu'un onglet,
// et on ne lui montre pas une porte fermée.
const TABS: { href: string; label: string; roles: Role[] }[] = [
  { href: "/finance", label: "Rentabilité", roles: ["DIR", "PM"] },
  { href: "/time", label: "Temps", roles: ["DEV", "PM", "DIR"] },
];

export function ScreenTabs({ active, role }: { active: "/finance" | "/time"; role: Role }) {
  const tabs = TABS.filter((t) => t.roles.includes(role));
  if (tabs.length < 2) return null;

  return (
    <div className="flex gap-1 rounded-lg border border-border bg-panel p-1 text-sm">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-md px-3 py-1.5 ${active === t.href ? "bg-mint/10 text-mint" : "text-muted hover:text-text"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
