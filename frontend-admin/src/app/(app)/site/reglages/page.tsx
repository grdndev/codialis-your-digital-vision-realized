import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { ImageField } from "../image-field";
import {
  saveBlogHeroAction,
  savePortfolioHeroAction,
  saveSocialsAction,
  saveLogosAction,
} from "../actions";
import { SOCIAL_ICONS, type SiteSettingsScreen } from "../types";

// Nombre de lignes vides proposées en plus de celles déjà enregistrées, pour
// pouvoir ajouter un réseau ou un logo sans passer par un bouton « + » et donc
// sans état côté client.
const SPARE_ROWS = 3;

// Défauts codés dans Portfolio.dc.html : on les affiche en indication pour que
// la direction sache ce que le site montre quand un champ est laissé vide.
const STAT_PLACEHOLDERS = [
  { v: "50", suffix: "+", l: "projets livrés" },
  { v: "4", suffix: "", l: "domaines d'expertise" },
  { v: "99,9", suffix: "%", l: "disponibilité moyenne" },
];

export default async function SiteSettingsPage() {
  await requireRole("PM", "DIR");
  const { settings } = await apiGet<SiteSettingsScreen>("/api/admin/site/settings");

  const blogHero = settings.blog_page.data.hero ?? {};
  const pfHero = settings.portfolio_page.data.hero ?? {};
  const stats = pfHero.stats ?? [];
  const socials = settings.contact_socials.data.items ?? [];
  const logos = settings.home_logos.data.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Réglages du site</h1>
        <p className="mt-1 text-sm text-muted">
          En-têtes de page, réseaux sociaux et logos clients. Un champ laissé vide
          rend au site sa valeur par défaut.
        </p>
      </div>

      <Card title="En-tête de la page Blog" updatedAt={settings.blog_page.updatedAt}>
        <form action={saveBlogHeroAction} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sur-titre">
              <input name="kicker" defaultValue={blogHero.kicker ?? ""} className="input" />
            </Field>
            <Field label="Mot mis en avant">
              <input name="accent" defaultValue={blogHero.accent ?? ""} className="input" />
            </Field>
          </div>
          <Field label="Sous-titre">
            <input name="sub" defaultValue={blogHero.sub ?? ""} className="input" />
          </Field>
          <Field label="Chapô">
            <textarea name="lead" rows={2} defaultValue={blogHero.lead ?? ""} className="input" />
          </Field>
          <SaveButton />
        </form>
      </Card>

      <Card title="En-tête de la page Portfolio" updatedAt={settings.portfolio_page.updatedAt}>
        <form action={savePortfolioHeroAction} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Titre">
              <input name="title" defaultValue={pfHero.title ?? ""} placeholder="Des projets qui parlent" className="input" />
            </Field>
            <Field label="Suite du titre, mise en avant">
              <input name="titleAccent" defaultValue={pfHero.titleAccent ?? ""} placeholder="d'eux-mêmes." className="input" />
            </Field>
          </div>
          <Field label="Sous-titre">
            <textarea name="subtitle" rows={2} defaultValue={pfHero.subtitle ?? ""} className="input" />
          </Field>
          <p className="text-xs font-medium text-muted">Chiffres de l’en-tête</p>
          {STAT_PLACEHOLDERS.map((ph, i) => (
            <div key={i} className="grid grid-cols-6 gap-2">
              <input
                name={`stat${i}v`}
                defaultValue={stats[i]?.v ?? ""}
                placeholder={ph.v}
                className="input col-span-1"
              />
              <input
                name={`stat${i}suffix`}
                defaultValue={stats[i]?.suffix ?? ""}
                placeholder={ph.suffix || "suffixe"}
                className="input col-span-1"
              />
              <input
                name={`stat${i}l`}
                defaultValue={stats[i]?.l ?? ""}
                placeholder={ph.l}
                className="input col-span-4"
              />
            </div>
          ))}
          <SaveButton />
        </form>
      </Card>

      <Card title="Réseaux sociaux" updatedAt={settings.contact_socials.updatedAt}>
        <p className="mb-3 text-xs text-muted">
          Affichés sur la page Contact et dans le pied de page de tout le site.
          Une ligne sans lien est ignorée — c’est ainsi qu’on retire un réseau.
        </p>
        <form action={saveSocialsAction} className="flex flex-col gap-2">
          {Array.from({ length: socials.length + SPARE_ROWS }, (_, i) => (
            <div key={i} className="grid grid-cols-4 gap-2">
              <select
                name={`social_${i}_icon`}
                defaultValue={socials[i]?.icon ?? "linkedin"}
                className="input col-span-1"
              >
                {SOCIAL_ICONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                name={`social_${i}_href`}
                defaultValue={socials[i]?.href ?? ""}
                placeholder="https://www.linkedin.com/company/…"
                className="input col-span-3"
              />
              <input type="hidden" name={`social_${i}_name`} value={socials[i]?.name ?? ""} />
            </div>
          ))}
          <SaveButton />
        </form>
      </Card>

      <Card title="Logos clients (page d’accueil)" updatedAt={settings.home_logos.updatedAt}>
        <p className="mb-3 text-xs text-muted">
          Carrousel « ils nous font confiance ». Une ligne sans image est ignorée.
        </p>
        <form action={saveLogosAction} className="flex flex-col gap-4">
          {Array.from({ length: logos.length + SPARE_ROWS }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-panel-2 p-3">
              <ImageField
                name={`logo_${i}_image`}
                defaultValue={logos[i]?.image ?? ""}
                label={`Logo ${i + 1}`}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  name={`logo_${i}_name`}
                  defaultValue={logos[i]?.name ?? ""}
                  placeholder="Nom du client"
                  className="input"
                />
                <input
                  name={`logo_${i}_href`}
                  defaultValue={logos[i]?.href ?? ""}
                  placeholder="Lien (facultatif)"
                  className="input"
                />
              </div>
            </div>
          ))}
          <SaveButton />
        </form>
      </Card>
    </div>
  );
}

function Card({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: Date | null;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <span className="text-xs text-muted">
          {updatedAt ? `enregistré ${fmtDateTime(updatedAt)}` : "jamais enregistré"}
        </span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

function SaveButton() {
  return (
    <div className="mt-1">
      <button type="submit" className="rounded-lg bg-mint px-4 py-2 text-xs font-semibold text-bg">
        Enregistrer
      </button>
    </div>
  );
}
