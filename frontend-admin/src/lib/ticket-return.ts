// Retour d'une fiche ticket vers l'écran d'où on l'a ouverte (CC-371).
//
// Une fiche projet ouvre ses tickets avec `?retour=<son adresse>` : vue,
// filtres et page compris, puisque tout cela vit dans l'adresse de la fiche.
// Le lien « ← » de la fiche ticket y ramène, au lieu de l'écran Tickets dont
// les filtres n'ont rien à voir avec ce qu'on regardait.
//
// Le retour voyage dans l'adresse, pas dans un cookie : les préchargements des
// liens passent aussi par proxy.ts, sans qu'il puisse les distinguer d'une
// vraie visite (Next lui retire l'en-tête `next-router-prefetch`), et un cookie
// est commun à tous les onglets. Les actions de la fiche qui la rechargent le
// reconduisent donc elles-mêmes.

// Seule une fiche projet de l'app est un retour valable. L'adresse est reprise
// telle quelle dans un lien et dans des redirections : sans ce contrôle,
// `?retour=https://…` enverrait n'importe où.
const RETOUR_PROJET = /^\/projects\/([A-Za-z0-9_-]+)(?:\?[^#]*)?$/;

export function parseRetour(value: unknown): string | null {
  return typeof value === "string" && RETOUR_PROJET.test(value) ? value : null;
}

// Le projet visé par un retour validé, pour en afficher le nom.
export function retourProjectId(retour: string): string | null {
  return RETOUR_PROJET.exec(retour)?.[1] ?? null;
}

// Adresse d'une fiche ticket, qui reconduit le retour. `extra` porte les
// bandeaux d'un passage (info, error).
export function ticketHref(ref: string, retour?: string | null, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams(retour ? { retour } : {});
  for (const [key, value] of Object.entries(extra)) query.set(key, value);
  const qs = query.toString();
  return `/tickets/${ref}${qs ? `?${qs}` : ""}`;
}

// Ajoute un paramètre à une adresse qui en porte peut-être déjà un.
export function withParam(href: string, key: string, value: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}
