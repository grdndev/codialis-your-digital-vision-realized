export type FeedItemStatus = "NEW" | "IGNORED" | "LATER" | "PUBLISHED";

export type FeedItemRow = {
  id: string;
  guid: string;
  source: string;
  category: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  image: string | null;
  link: string;
  publishedAt: Date | null;
  status: FeedItemStatus;
  fetchedAt: Date;
};

export type VeilleScreen = {
  items: FeedItemRow[];
  counts: { total: number; byCategory: Record<string, number> };
  // Fenêtre de fraîcheur configurée dans backend/config/feeds.json.
  maxAgeDays: number;
};

// Résultat d'un rafraîchissement : `ok: false` sur un flux signale une source
// en panne, sans avoir interrompu les autres.
export type RefreshSummary = {
  added: number;
  purged: number;
  total: number;
  feeds: { label: string; ok: boolean; count: number; dropped: number; error: string | null }[];
};

// Brouillon d'article prêt à pré-remplir le formulaire du blog.
export type VeilleDraft = {
  draft: {
    cat: string;
    title: string;
    excerpt: string;
    content: string;
    image: string;
    source: string;
    date: string;
    read: string;
    featured: boolean;
  };
};

// Catégories de veille : un surensemble de celles du blog. Les cinq en plus
// deviennent des catégories personnalisées à la publication.
export const VEILLE_CATEGORIES = [
  { value: "all", label: "Tout" },
  { value: "development", label: "Développement" },
  { value: "ia", label: "IA" },
  { value: "saas", label: "SaaS" },
  { value: "funding", label: "Financement" },
  { value: "design", label: "Design UX" },
  { value: "cyber", label: "Cybersécurité" },
  { value: "startups", label: "Startups" },
  { value: "data", label: "Data" },
  { value: "opensource", label: "Open Source" },
] as const;

export const STATUS_TABS: { value: FeedItemStatus; label: string }[] = [
  { value: "NEW", label: "À trier" },
  { value: "LATER", label: "Plus tard" },
  { value: "PUBLISHED", label: "Publiés" },
  { value: "IGNORED", label: "Ignorés" },
];
