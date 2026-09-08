// Nom du cookie de session posé par frontend-admin sur son propre domaine.
//
// Le backend ne pose aucun cookie : il émet un JWT dans le corps de la réponse
// de connexion, et frontend-admin le range ici en httpOnly. Les deux
// applications sont donc sur des domaines différents sans qu'aucun cookie ne
// traverse une frontière d'origine (voir src/lib/api.ts).
export const SESSION_COOKIE = "codialis_session";
