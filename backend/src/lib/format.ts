// Formatage de nombres nécessaire côté API.
//
// Le backend n'a plus de couche visuelle, mais il compose encore du texte
// destiné à être lu : le brouillon de réponse et son argumentaire (voir
// ai-draft.ts) citent des volumes d'heures en clair. C'est la seule raison
// d'être de ce module — l'essentiel du formatage vit désormais dans
// frontend-admin/src/lib/format.ts, dont ceci est un extrait volontairement
// minimal plutôt qu'une copie.
export function fmtHours(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
  return `${str} h`;
}
