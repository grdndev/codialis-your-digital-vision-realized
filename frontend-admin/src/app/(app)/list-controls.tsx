import Link from "next/link";

// Filtres en pastilles et pagination, partagés par les listes du back-office
// (écran Tickets, tickets d'une fiche projet, Ressources). Tout passe par
// l'adresse : un filtre ou une page est un lien, pas un état de composant, ce
// qui garde les pages en Server Components et rend chaque vue partageable.

export const PER_PAGE_OPTIONS = [15, 25, 50] as const;
const DEFAULT_PER_PAGE = PER_PAGE_OPTIONS[0];

// Lecture défensive : une adresse retouchée à la main (`per=1000`, `page=-3`)
// retombe sur une valeur admise plutôt que de casser l'écran.
export function parsePaging(page: string | undefined, per: string | undefined) {
  const perPage = PER_PAGE_OPTIONS.find((n) => String(n) === per) ?? DEFAULT_PER_PAGE;
  const requested = Number.parseInt(page ?? "", 10);
  return { page: Number.isFinite(requested) && requested > 0 ? requested : 1, perPage };
}

// La page demandée est bornée au nombre de pages RÉEL : un filtre qui réduit la
// liste pendant qu'on est en page 4 ne doit pas afficher une page vide.
export function paginate<T>(items: T[], page: number, perPage: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * perPage;
  return { rows: items.slice(start, start + perPage), page: current, pageCount, total: items.length };
}

// Valeurs multiples d'un critère, séparées par des virgules dans l'adresse.
export function listParam(value: string | undefined): string[] {
  return (value ?? "").split(",").filter(Boolean);
}

export function toggleValue(current: string[], value: string): string | null {
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return next.join(",") || null;
}

// Un groupe de choix ne se coupe pas : `flex-nowrap` garde « Tous types ·
// Bugs · Développement » d'un seul tenant, le retour à la ligne se fait entre
// les groupes.
export function FilterGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-nowrap items-center gap-2">{children}</div>;
}

export function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full border px-2.5 py-1 transition ${
        active ? "border-mint/40 bg-mint/10 text-text" : "border-border text-muted hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}

// `hrefFor` reçoit la page et la taille de page visées et rend l'adresse
// complète : c'est l'écran qui sait quels filtres reconduire, pas ce composant.
export function Pagination({
  page,
  pageCount,
  perPage,
  total,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  perPage: number;
  total: number;
  hrefFor: (page: number, perPage: number) => string;
}) {
  const first = total === 0 ? 0 : (page - 1) * perPage + 1;
  const last = Math.min(total, page * perPage);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
      <div className="flex items-center gap-2">
        <span>Par page</span>
        {PER_PAGE_OPTIONS.map((n) => (
          // Changer la taille de page repart de la première : la page 3 de 15
          // n'a pas d'équivalent exact en pages de 50.
          <FilterLink key={n} href={hrefFor(1, n)} active={n === perPage}>
            {n}
          </FilterLink>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span>
          {first}–{last} sur {total} · page {page} / {pageCount}
        </span>
        <PageLink href={page > 1 ? hrefFor(page - 1, perPage) : null}>‹ Précédent</PageLink>
        <PageLink href={page < pageCount ? hrefFor(page + 1, perPage) : null}>Suivant ›</PageLink>
      </div>
    </div>
  );
}

// Au bord de la liste, le bouton reste à sa place mais inerte : la barre ne
// saute pas d'une page à l'autre.
function PageLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) {
    return <span className="rounded-lg border border-border px-2.5 py-1 text-muted/40">{children}</span>;
  }
  return (
    <Link href={href} className="rounded-lg border border-border px-2.5 py-1 text-muted transition hover:border-mint/40 hover:text-mint">
      {children}
    </Link>
  );
}
