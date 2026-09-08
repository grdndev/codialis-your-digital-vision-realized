import { z } from "zod";

// Formes du contenu éditorial du site vitrine.
//
// Ces schémas sont la garantie que le back-office n'écrit jamais en base un
// objet que le site public ne saurait pas lire. Ils sont dérivés du code de
// lecture de `../frontend-public` — c'est lui le contrat, et il est figé :
//   - blog          -> Blog.dc.html
//   - portfolio     -> Portfolio.dc.html
//   - testimonials  -> index.html
// Tout champ ajouté ici doit être un champ que le site lit réellement.

// Une image est soit une URL du site (`/assets/...`), soit une data URL base64
// (le formulaire convertit le fichier déposé), soit vide.
const image = z.string().max(4_000_000);

// Catégories rendues par Blog.dc.html (`catDefs`, hors « all »). Une catégorie
// hors liste s'afficherait sous sa clé brute au lieu de son libellé.
export const BLOG_CATEGORIES = [
  "dev",
  "ia",
  "saas",
  "funding",
  "design",
  "cyber",
  "startups",
  "data",
  "mobile",
  "opensource",
] as const;

export const blogSchema = z.object({
  cat: z.enum(BLOG_CATEGORIES),
  title: z.string().min(1).max(300),
  excerpt: z.string().max(5000),
  content: z.string().max(100_000),
  // Date et durée de lecture sont des libellés libres, affichés tels quels
  // (« 12 août 2026 », « 4 min ») : le site ne les interprète pas.
  date: z.string().max(60),
  read: z.string().max(30),
  image,
  featured: z.boolean(),
  // Lien vers l'article d'origine, pour un article repris d'une source externe.
  source: z.string().max(2000),
});

export const portfolioSchema = z.object({
  // Un badge par secteur. Portfolio.dc.html accepte aussi une chaîne (ancien
  // format) mais n'écrit plus que des tableaux.
  sector: z.array(z.string().min(1).max(80)).min(1).max(6),
  title: z.string().min(1).max(300),
  desc: z.string().max(5000),
  image,
  tech: z.array(z.string().min(1).max(60)).max(20),
  // Chiffres clés : `v` la valeur, `l` le libellé.
  results: z.array(z.object({ v: z.string().max(40), l: z.string().max(120) })).max(4),
  featured: z.boolean(),
});

export const testimonialSchema = z.object({
  quote: z.string().min(1).max(3000),
  author: z.string().min(1).max(200),
  company: z.string().max(200),
  // Calculés côté API (initiales de l'auteur, couleur d'avatar) : le
  // formulaire ne les saisit pas.
  initials: z.string().max(4),
  bg: z.string().max(32),
});

// Palette d'avatars des témoignages, reprise de l'ancien back-office.
export const TESTIMONIAL_PALETTE = [
  "#2FED7F",
  "#7FE6C4",
  "#A7D8F0",
  "#C9C2F5",
  "#F5C86B",
  "#F5A8C0",
];

// Initiales d'un nom : « Marie Dupont » -> « MD », « Codialis » -> « CO ».
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// --- Réglages de page ------------------------------------------------------

// Icônes réellement dessinées par Contact.dc.html et footer-socials.js. Une
// valeur hors liste n'afficherait aucune icône.
export const SOCIAL_ICONS = [
  "linkedin",
  "instagram",
  "facebook",
  "x",
  "youtube",
  "tiktok",
  "github",
] as const;

export const SOCIAL_ICON_LABEL: Record<(typeof SOCIAL_ICONS)[number], string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X (Twitter)",
  youtube: "YouTube",
  tiktok: "TikTok",
  github: "GitHub",
};

export const settingsSchemas = {
  blog_page: z.object({
    hero: z.object({
      kicker: z.string().max(200),
      accent: z.string().max(200),
      sub: z.string().max(600),
      lead: z.string().max(600),
    }),
  }),
  portfolio_page: z.object({
    hero: z.object({
      title: z.string().max(200),
      titleAccent: z.string().max(200),
      subtitle: z.string().max(800),
      stats: z
        .array(
          z.object({
            v: z.string().max(20),
            suffix: z.string().max(8),
            l: z.string().max(120),
          }),
        )
        .max(4),
    }),
  }),
  contact_socials: z.object({
    items: z
      .array(
        z.object({
          icon: z.enum(SOCIAL_ICONS),
          href: z.string().min(1).max(2000),
          name: z.string().max(80),
        }),
      )
      .max(10),
  }),
  home_logos: z.object({
    items: z
      .array(
        z.object({
          image,
          name: z.string().max(120),
          href: z.string().max(2000),
        }),
      )
      .max(24),
  }),
};

export const SETTING_KEYS = Object.keys(settingsSchemas) as (keyof typeof settingsSchemas)[];
