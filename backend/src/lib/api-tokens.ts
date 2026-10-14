import "server-only";
import { createHash, randomBytes } from "node:crypto";

// Jetons d'API personnels (modèle ApiToken).
//
// Un jeton est une chaîne opaque, pas un JWT : il doit pouvoir être révoqué à
// tout instant, ce qu'une signature seule ne permet pas. Le préfixe `cdl_` le
// distingue d'un jeton de session dans l'en-tête Authorization, et le rend
// repérable par les détecteurs de secrets s'il fuit dans un dépôt.
//
// Seul le SHA-256 est stocké, comme pour les liens d'e-mail (tokens.ts) : une
// fuite de la base ne donne aucun jeton utilisable. 32 octets aléatoires
// rendent toute tentative d'en deviner un sans objet.

export const API_TOKEN_PREFIX = "cdl_";

export function hashApiToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function isApiToken(raw: string): boolean {
  return raw.startsWith(API_TOKEN_PREFIX);
}

// Renvoie le jeton EN CLAIR, à montrer une seule fois, et ce qui en est stocké.
export function generateApiToken(): { raw: string; hash: string; prefix: string } {
  const raw = `${API_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { raw, hash: hashApiToken(raw), prefix: raw.slice(0, API_TOKEN_PREFIX.length + 8) };
}

// Durées proposées à la création. `null` = sans expiration : un poste de
// développeur qu'on ne veut pas reconfigurer tous les trois mois.
export const API_TOKEN_DURATIONS = { "30": 30, "90": 90, "365": 365, jamais: null } as const;
export type ApiTokenDuration = keyof typeof API_TOKEN_DURATIONS;
