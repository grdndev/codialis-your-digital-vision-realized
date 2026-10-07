// Formatage de nombres nécessaire côté API.
//
// Le backend n'a plus de couche visuelle, mais il compose encore du texte
// destiné à être lu : le brouillon de réponse et son argumentaire (voir
// ai-draft.ts) citent des volumes d'heures en clair. C'est la seule raison
// d'être de ce module — l'essentiel du formatage vit désormais dans
// frontend-admin/src/lib/format.ts, dont ceci est un extrait volontairement
// minimal plutôt qu'une copie.
// Une durée en heures et minutes entières : « 1 h 30 m » plutôt que « 1,5 h »,
// qu'il fallait convertir de tête (demande du 07/10), comme dans frontend-admin.
// Arrondi à la minute ; les zéros se taisent : « 8 h », « 45 m ».
export function fmtHours(n: number): string {
  const totalMinutes = Math.round(Math.abs(n) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const sign = n < 0 && totalMinutes > 0 ? "-" : "";
  if (minutes === 0) return `${sign}${hours} h`;
  if (hours === 0) return `${sign}${minutes} m`;
  return `${sign}${hours} h ${minutes} m`;
}
