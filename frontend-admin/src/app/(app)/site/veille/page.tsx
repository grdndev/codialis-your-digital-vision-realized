import Link from "next/link";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import {
  refreshFeedsAction,
  setFeedStatusAction,
  setFeedCategoryAction,
  publishFeedItemAction,
} from "./actions";
import {
  STATUS_TABS,
  VEILLE_CATEGORIES,
  type FeedItemStatus,
  type VeilleScreen,
} from "./types";

function isStatus(value: string | undefined): value is FeedItemStatus {
  return value === "NEW" || value === "LATER" || value === "PUBLISHED" || value === "IGNORED";
}

export default async function VeillePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    category?: string;
    q?: string;
    added?: string;
    purged?: string;
    broken?: string;
  }>;
}) {
  await requireRole("PM", "DIR");
  const sp = await searchParams;
  const status: FeedItemStatus = isStatus(sp.status) ? sp.status : "NEW";
  const category = sp.category ?? "all";
  const search = sp.q ?? "";

  const query = new URLSearchParams({ status });
  if (category !== "all") query.set("category", category);
  if (search) query.set("q", search);

  const { items, counts, maxAgeDays } = await apiGet<VeilleScreen>(
    `/api/admin/site/veille?${query}`,
  );

  // Conserve les filtres courants quand on change l'un d'eux.
  function href(next: Partial<{ status: string; category: string; q: string }>) {
    const p = new URLSearchParams({ status, category, ...(search ? { q: search } : {}) });
    for (const [k, v] of Object.entries(next)) p.set(k, v);
    return `/site/veille?${p}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text">Veille</h1>
          <p className="mt-1 text-sm text-muted">
            {counts.total} article{counts.total > 1 ? "s" : ""} à trier · fenêtre de{" "}
            {maxAgeDays} jours · sources dans <code className="text-xs">backend/config/feeds.json</code>
          </p>
        </div>
        <form action={refreshFeedsAction}>
          <button
            type="submit"
            className="rounded-lg bg-mint px-4 py-2 text-xs font-semibold text-bg"
          >
            Rafraîchir les flux
          </button>
        </form>
      </div>

      {sp.added !== undefined ? (
        <p className="rounded-xl border border-mint/30 bg-mint/5 px-4 py-2.5 text-sm text-mint">
          {sp.added} nouvel article(s), {sp.purged ?? 0} périmé(s) purgé(s).
        </p>
      ) : null}
      {sp.broken ? (
        <p className="rounded-xl border border-amber/30 bg-amber/5 px-4 py-2.5 text-sm text-amber">
          Sources injoignables : {sp.broken.split(",").join(", ")}. Les autres flux ont
          bien été lus.
        </p>
      ) : null}

      <div className="flex gap-1 rounded-lg border border-border bg-panel p-1 text-sm">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.value}
            href={href({ status: t.value })}
            className={`rounded-md px-3 py-1.5 ${status === t.value ? "bg-mint/10 text-mint" : "text-muted hover:text-text"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {VEILLE_CATEGORIES.map((c) => {
          const n = c.value === "all" ? counts.total : (counts.byCategory[c.value] ?? 0);
          return (
            <Link
              key={c.value}
              href={href({ category: c.value })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                category === c.value
                  ? "border-mint/40 bg-mint/10 text-text"
                  : "border-border text-muted hover:text-text"
              }`}
            >
              {c.label}
              {n > 0 ? <span className="ml-1.5 text-muted">{n}</span> : null}
            </Link>
          );
        })}
        <form action="/site/veille" className="ml-auto flex items-center gap-2">
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="category" value={category} />
          <input
            name="q"
            defaultValue={search}
            placeholder="Rechercher…"
            className="input w-48"
          />
        </form>
      </div>

      <div className="flex flex-col gap-3">
        {items.length === 0 ? (
          <p className="rounded-xl border border-border bg-panel px-5 py-6 text-sm text-muted">
            Aucun article. Lancez un rafraîchissement pour aller chercher les nouveautés.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex gap-4 rounded-xl border border-border bg-panel p-4">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  className="h-20 w-28 shrink-0 rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted">
                  sans visuel
                </div>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-text hover:text-mint"
                  >
                    {item.title}
                  </a>
                  <p className="mt-0.5 text-xs text-muted">
                    {item.source}
                    {item.publishedAt ? ` · ${fmtDate(item.publishedAt)}` : ""}
                  </p>
                </div>
                {item.excerpt ? (
                  <p className="line-clamp-2 text-xs text-muted">{item.excerpt}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  {/* Recatégoriser avant de publier : la catégorie du flux est
                      un défaut, pas une vérité. */}
                  <form
                    action={setFeedCategoryAction.bind(null, item.id)}
                    className="flex items-center gap-1.5"
                  >
                    <select name="category" defaultValue={item.category} className="input text-xs">
                      {VEILLE_CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted hover:text-text"
                    >
                      Reclasser
                    </button>
                  </form>

                  {item.status !== "PUBLISHED" ? (
                    <form action={publishFeedItemAction.bind(null, item.id)}>
                      <button
                        type="submit"
                        className="rounded-lg bg-mint px-2.5 py-1 text-xs font-semibold text-bg"
                        title="Crée un brouillon d'article dans le blog, image et corps récupérés depuis la source"
                      >
                        Publier au blog
                      </button>
                    </form>
                  ) : null}

                  {item.status !== "LATER" ? (
                    <form action={setFeedStatusAction.bind(null, item.id, "LATER")}>
                      <button
                        type="submit"
                        className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text"
                      >
                        Plus tard
                      </button>
                    </form>
                  ) : null}

                  {item.status !== "IGNORED" ? (
                    <form action={setFeedStatusAction.bind(null, item.id, "IGNORED")}>
                      <button
                        type="submit"
                        className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-red/50 hover:text-red"
                      >
                        Ignorer
                      </button>
                    </form>
                  ) : null}

                  {item.status !== "NEW" ? (
                    <form action={setFeedStatusAction.bind(null, item.id, "NEW")}>
                      <button
                        type="submit"
                        className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text"
                      >
                        Remettre à trier
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
