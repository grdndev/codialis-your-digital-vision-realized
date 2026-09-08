"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

export function Sidebar({ items, title }: { items: NavItem[]; title?: string }) {
  const pathname = usePathname();

  // L'entrée active est celle dont le chemin est le PLUS LONG préfixe de l'URL
  // courante. Un simple `startsWith` surlignerait « Contenu du site » (/site)
  // en même temps que « Réglages du site » (/site/reglages).
  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .reduce<string | null>((best, item) => (best && best.length >= item.href.length ? best : item.href), null);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-panel-2 px-3 py-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint/15 text-sm font-semibold text-mint">
          C
        </div>
        <span className="truncate text-sm font-semibold text-text">{title ?? "Codialis"}</span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-mint/10 font-medium text-mint"
                  : "text-muted hover:bg-panel hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
