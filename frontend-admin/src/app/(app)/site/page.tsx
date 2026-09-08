import Link from "next/link";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { ImageField } from "./image-field";
import { saveContentAction, deleteContentAction } from "./actions";
import {
  BLOG_CATEGORIES,
  type SiteContentItem,
  type SiteContentScreen,
  type SiteContentType,
} from "./types";

const TABS: { id: SiteContentType; label: string; empty: string }[] = [
  { id: "portfolio", label: "Portfolio", empty: "Aucun projet publié." },
  { id: "blog", label: "Blog", empty: "Aucun article publié." },
  { id: "testimonials", label: "Témoignages", empty: "Aucun témoignage publié." },
];

function isType(value: string | undefined): value is SiteContentType {
  return value === "portfolio" || value === "blog" || value === "testimonials";
}

// Les secteurs et technologies sont stockés en tableau ; un projet ancien peut
// encore porter une chaîne. On normalise pour l'affichage et le formulaire.
function toList(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [String(value)] : [];
}

export default async function SiteContentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; edit?: string; saved?: string; deleted?: string }>;
}) {
  await requireRole("PM", "DIR");
  const sp = await searchParams;
  const type: SiteContentType = isType(sp.type) ? sp.type : "portfolio";

  const { items } = await apiGet<SiteContentScreen>(`/api/admin/site/content?type=${type}`);
  const editing = sp.edit ? items.find((i) => i.id === sp.edit) : undefined;
  const tab = TABS.find((t) => t.id === type)!;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Contenu du site</h1>
        <p className="mt-1 text-sm text-muted">
          Ce que publie codialis.com — mis en ligne dès l’enregistrement.
        </p>
      </div>

      {sp.saved ? <Banner tone="mint">Contenu enregistré.</Banner> : null}
      {sp.deleted ? <Banner tone="amber">Contenu supprimé.</Banner> : null}

      <div className="flex gap-1 rounded-lg border border-border bg-panel p-1 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/site?type=${t.id}`}
            className={`rounded-md px-3 py-1.5 ${type === t.id ? "bg-mint/10 text-mint" : "text-muted hover:text-text"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-text">
            {tab.label} · {items.length} publié{items.length > 1 ? "s" : ""}
          </h2>
          {editing ? (
            <Link href={`/site?type=${type}`} className="text-xs text-muted hover:text-text">
              Annuler la modification
            </Link>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">{tab.empty}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt=""
                    className="h-10 w-14 shrink-0 rounded border border-border object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-text">
                    {type === "testimonials" ? item.author || "(sans auteur)" : item.title || "(sans titre)"}
                    {item.featured ? (
                      <span className="ml-2 rounded-full bg-mint/10 px-2 py-0.5 text-[10px] font-medium text-mint">
                        à la une
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {type === "blog"
                      ? `${BLOG_CATEGORIES.find((c) => c.value === item.cat)?.label ?? item.cat ?? "—"} · ${item.date || "sans date"}`
                      : type === "portfolio"
                        ? toList(item.sector).join(" · ") || "sans secteur"
                        : item.company || "—"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted">{item.views} vue{item.views > 1 ? "s" : ""}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/site?type=${type}&edit=${item.id}`}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text"
                  >
                    Modifier
                  </Link>
                  <form action={deleteContentAction.bind(null, type, item.id)}>
                    <button
                      type="submit"
                      className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-red/50 hover:text-red"
                    >
                      Supprimer
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold text-text">
          {editing ? `Modifier · ${tab.label}` : `Ajouter · ${tab.label}`}
        </h2>
        {/* Une clé qui change force React à réinitialiser les champs quand on
            passe d'un contenu édité à un autre, ou au formulaire vierge. */}
        <form
          key={editing?.id ?? `new-${type}`}
          action={saveContentAction.bind(null, type)}
          className="mt-4 flex flex-col gap-4"
        >
          <input type="hidden" name="id" value={editing?.id ?? ""} />

          {type === "blog" ? <BlogFields item={editing} /> : null}
          {type === "portfolio" ? <PortfolioFields item={editing} /> : null}
          {type === "testimonials" ? <TestimonialFields item={editing} /> : null}

          <div>
            <button
              type="submit"
              className="rounded-lg bg-mint px-4 py-2 text-xs font-semibold text-bg"
            >
              {editing ? "Enregistrer les modifications" : "Publier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BlogFields({ item }: { item?: SiteContentItem }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Titre" className="col-span-2">
          <input name="title" required defaultValue={item?.title ?? ""} className="input" />
        </Field>
        <Field label="Catégorie">
          <select name="cat" defaultValue={item?.cat ?? "dev"} className="input">
            {BLOG_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Accroche (affichée dans la liste)">
        <textarea name="excerpt" rows={2} defaultValue={item?.excerpt ?? ""} className="input" />
      </Field>
      <Field label="Article complet (affiché dans la pop-up)">
        <textarea name="content" rows={8} defaultValue={item?.content ?? ""} className="input" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Date affichée" hint="libellé libre, ex. 12 août 2026">
          <input name="date" defaultValue={item?.date ?? ""} className="input" />
        </Field>
        <Field label="Durée de lecture" hint="ex. 4 min">
          <input name="read" defaultValue={item?.read ?? ""} className="input" />
        </Field>
        <Field label="Source" hint="lien d’origine, facultatif">
          <input name="source" defaultValue={item?.source ?? ""} className="input" />
        </Field>
      </div>
      <ImageField name="image" defaultValue={item?.image ?? ""} label="Illustration" />
      <FeaturedCheckbox defaultChecked={!!item?.featured} hint="Un seul article à la fois." />
    </>
  );
}

function PortfolioFields({ item }: { item?: SiteContentItem }) {
  const results = item?.results ?? [];
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Titre du projet">
          <input name="title" required defaultValue={item?.title ?? ""} className="input" />
        </Field>
        <Field label="Secteurs" hint="séparés par des virgules, au moins un">
          <input
            name="sector"
            required
            defaultValue={toList(item?.sector).join(", ")}
            className="input"
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea name="desc" rows={4} defaultValue={item?.desc ?? ""} className="input" />
      </Field>
      <Field label="Technologies" hint="séparées par des virgules">
        <input name="tech" defaultValue={toList(item?.tech).join(", ")} className="input" />
      </Field>
      <div className="grid grid-cols-4 gap-3">
        <Field label="Chiffre clé 1">
          <input name="r1v" defaultValue={results[0]?.v ?? ""} className="input" />
        </Field>
        <Field label="Libellé 1">
          <input name="r1l" defaultValue={results[0]?.l ?? ""} className="input" />
        </Field>
        <Field label="Chiffre clé 2">
          <input name="r2v" defaultValue={results[1]?.v ?? ""} className="input" />
        </Field>
        <Field label="Libellé 2">
          <input name="r2l" defaultValue={results[1]?.l ?? ""} className="input" />
        </Field>
      </div>
      <ImageField name="image" defaultValue={item?.image ?? ""} label="Visuel du projet" />
      <FeaturedCheckbox defaultChecked={!!item?.featured} hint="Un seul projet à la fois." />
    </>
  );
}

function TestimonialFields({ item }: { item?: SiteContentItem }) {
  return (
    <>
      <Field label="Témoignage">
        <textarea name="quote" rows={4} required defaultValue={item?.quote ?? ""} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Auteur" hint="les initiales de l’avatar en sont déduites">
          <input name="author" required defaultValue={item?.author ?? ""} className="input" />
        </Field>
        <Field label="Entreprise">
          <input name="company" defaultValue={item?.company ?? ""} className="input" />
        </Field>
      </div>
    </>
  );
}

function FeaturedCheckbox({ defaultChecked, hint }: { defaultChecked: boolean; hint: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <input type="checkbox" name="featured" defaultChecked={defaultChecked} />
      Mettre à la une <span className="text-[11px]">({hint})</span>
    </label>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label className="text-xs font-medium text-muted">
        {label}
        {hint ? <span className="ml-1 font-normal text-[11px]">— {hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

function Banner({ tone, children }: { tone: "mint" | "amber"; children: React.ReactNode }) {
  const cls = tone === "mint" ? "border-mint/30 bg-mint/5 text-mint" : "border-amber/30 bg-amber/5 text-amber";
  return <p className={`rounded-xl border px-4 py-2.5 text-sm ${cls}`}>{children}</p>;
}
