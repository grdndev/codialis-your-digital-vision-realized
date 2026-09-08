// Formes du contenu du site vitrine, côté back-office.
//
// Elles doivent rester alignées sur `backend/src/lib/site-schemas.ts`, qui les
// valide, et donc sur ce que lit `frontend-public`. Un champ ajouté ici sans
// l'être là-bas serait rejeté à l'enregistrement.

export const BLOG_CATEGORIES = [
  { value: "dev", label: "Développement" },
  { value: "ia", label: "IA" },
  { value: "saas", label: "SaaS" },
  { value: "funding", label: "Financement" },
  { value: "design", label: "Design UX" },
  { value: "cyber", label: "Cybersécurité" },
  { value: "startups", label: "Startups" },
  { value: "data", label: "Data" },
  { value: "mobile", label: "Mobile" },
  { value: "opensource", label: "Open Source" },
] as const;

export const SOCIAL_ICONS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "x", label: "X (Twitter)" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "github", label: "GitHub" },
] as const;

export type SiteContentType = "blog" | "portfolio" | "testimonials";

export type BlogItem = {
  id: string;
  views: number;
  cat: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  read: string;
  image: string;
  featured: boolean;
  source: string;
};

export type PortfolioItem = {
  id: string;
  views: number;
  sector: string[] | string;
  title: string;
  desc: string;
  image: string;
  tech: string[];
  results: { v: string; l: string }[];
  featured: boolean;
};

export type TestimonialItem = {
  id: string;
  views: number;
  quote: string;
  author: string;
  company: string;
  initials: string;
  bg: string;
};

// L'API renvoie la même forme aplatie que la route publique. Les champs sont
// optionnels parce qu'un contenu créé avant un ajout de champ peut ne pas les
// porter — l'affichage retombe sur une valeur vide.
export type SiteContentItem = Partial<BlogItem & PortfolioItem & TestimonialItem> & {
  id: string;
  views: number;
};

export type SiteContentScreen = { items: SiteContentItem[] };

// --- Réglages de page ------------------------------------------------------

export type BlogPageSetting = {
  hero?: { kicker?: string; accent?: string; sub?: string; lead?: string };
};

export type PortfolioPageSetting = {
  hero?: {
    title?: string;
    titleAccent?: string;
    subtitle?: string;
    stats?: { v: string; suffix: string; l: string }[];
  };
  // Bloc « à la une » de repli, affiché quand aucun projet n'est coché. Il
  // n'est pas éditable depuis cet écran mais doit survivre à un enregistrement.
  featured?: Record<string, unknown>;
};

export type SocialItem = { icon: string; href: string; name: string };
export type LogoItem = { image: string; name: string; href: string };

export type SiteSettingsScreen = {
  settings: {
    blog_page: { data: BlogPageSetting; updatedAt: Date | null };
    portfolio_page: { data: PortfolioPageSetting; updatedAt: Date | null };
    contact_socials: { data: { items?: SocialItem[] }; updatedAt: Date | null };
    home_logos: { data: { items?: LogoItem[] }; updatedAt: Date | null };
  };
};

// --- Retours du site -------------------------------------------------------

export type ContactRequestRow = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  project: string;
  budget: string;
  message: string | null;
  status: string;
  createdAt: Date;
};

export type SubscriberRow = { id: string; email: string; createdAt: Date };

export type SiteInboxScreen = {
  contactRequests: ContactRequestRow[];
  subscribers: SubscriberRow[];
  pageViews: { portfolio: number; blog: number };
  topContent: { id: string; type: string; title: string; views: number }[];
};

export const CONTACT_STATUS_LABEL: Record<string, string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  traite: "Traité",
};

export const CONTACT_STATUS_CLASS: Record<string, string> = {
  nouveau: "bg-mint/10 text-mint",
  en_cours: "bg-amber/10 text-amber",
  traite: "bg-white/5 text-muted",
};
