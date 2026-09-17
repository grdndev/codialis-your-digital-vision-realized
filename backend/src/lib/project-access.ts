import "server-only";

// Cloisonnement des projets pour les rôles INTERNES : il n'y en a plus.
//
// Développeurs, chefferie et direction voient tous les projets. Seuls les
// comptes CLIENT restent cloisonnés, et par un autre chemin — `client-scope.ts`
// déduit leur projet de leur session.
//
// Ce qui a été essayé avant, et pourquoi c'est abandonné : l'accès était réservé
// aux développeurs AFFECTÉS au projet (`ProjectAssignment`). Aucun écran n'a
// jamais permis de créer une affectation ; la table est restée vide en
// production, et la règle a donc surtout servi à masquer des projets à tout le
// monde. Un développeur qui ouvrait un ticket par son adresse tombait sur un
// 404 sans explication.
//
// Le module est conservé pour garder la trace de cette décision et pour offrir
// un seul endroit à modifier si un cloisonnement interne revient un jour.

export async function devCanSeeProject(): Promise<boolean> {
  return true;
}
