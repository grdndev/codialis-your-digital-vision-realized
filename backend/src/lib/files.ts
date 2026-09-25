import "server-only";

// Client du service de stockage `codialis.files`.
//
// Le navigateur ne parle jamais à ce service en écriture : il envoie le fichier
// à frontend-admin, qui le relaie au backend, qui seul connaît le port privé et
// le jeton. La LECTURE, elle, est publique et directe (files.codialis.com), ce
// qui évite de faire transiter chaque image par deux serveurs Next.
//
// Pas de SDK ni de dépendance : `fetch` suffit, comme pour Brevo et Gemini.

// Port PRIVÉ du service, jamais exposé par Traefik. `files` est son alias
// réseau : un nom de service contenant un point est résolu de façon capricieuse.
const INTERNE = () => (process.env.FILES_INTERNAL_URL || "http://files:3004").replace(/\/+$/, "");
const PUBLIQUE = () => (process.env.FILES_PUBLIC_URL || "https://files.codialis.com").replace(/\/+$/, "");

// Doit rester aligné sur files/src/stockage.js : c'est le service qui refuse
// pour de bon, cette liste n'est là que pour répondre avant d'envoyer 20 Mo.
export const EXTENSIONS_IMAGE = ["png", "jpg", "jpeg", "webp", "gif", "avif"] as const;
export const TAILLE_MAX_OCTETS = 25 * 1024 * 1024;

export function filesConfigured(): boolean {
  return Boolean(process.env.FILES_TOKEN);
}

export function urlPublique(fileId: string): string {
  return `${PUBLIQUE()}/${fileId}`;
}

// L'extension vient du nom du fichier déposé : le service refuse tout ce qui
// n'est pas une image, et vérifie en plus la signature binaire du contenu.
export function extensionDe(filename: string): string {
  const point = filename.lastIndexOf(".");
  return point === -1 ? "" : filename.slice(point + 1).toLowerCase();
}

export function extensionAcceptee(extension: string): boolean {
  return (EXTENSIONS_IMAGE as readonly string[]).includes(extension);
}

async function appel(chemin: string, init: RequestInit): Promise<Response> {
  const jeton = process.env.FILES_TOKEN;
  if (!jeton) throw new Error("FILES_TOKEN manquant : le stockage de fichiers n'est pas configuré.");
  return fetch(`${INTERNE()}${chemin}`, {
    ...init,
    headers: { ...(init.headers ?? {}), "x-files-token": jeton },
    cache: "no-store",
  });
}

// Rend l'identifiant du fichier, qui est aussi son nom sur disque.
export async function envoyerImage(extension: string, contenu: ArrayBuffer): Promise<string> {
  const res = await appel(`/upload?ext=${encodeURIComponent(extension)}`, {
    method: "POST",
    body: contenu,
  });
  const corps = (await res.json().catch(() => ({}))) as { id?: string; erreur?: string };
  if (!res.ok || !corps.id) {
    throw new Error(corps.erreur ?? `Stockage de fichiers : ${res.status}`);
  }
  return corps.id;
}

// Best effort : une pièce jointe retirée de la base ne doit pas rester en base
// parce que le fichier n'a pas pu être effacé. Le fichier orphelin est sans
// conséquence, la ligne fantôme se verrait à l'écran.
export async function supprimerFichier(fileId: string): Promise<void> {
  try {
    await appel(`/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  } catch (err) {
    console.error("Suppression du fichier en échec:", fileId, err);
  }
}

// Les écrans ne connaissent pas l'adresse publique du stockage : le backend la
// joint à chaque pièce jointe. Une pièce sans fichier (libellé seul, ou fichier
// resté dans Drive) reçoit `null` et ne devient pas un lien mort.
export function avecUrlPublique<T extends { fileId: string | null }>(piece: T): T & { url: string | null } {
  return { ...piece, url: piece.fileId ? urlPublique(piece.fileId) : null };
}

// Supprimer un ticket ou une tâche efface ses pièces jointes EN CASCADE, côté
// base : la route de retrait n'est pas appelée, et les fichiers resteraient
// dans le volume sans que plus rien ne pointe dessus. On les reprend donc
// avant, pendant que les lignes existent encore.
export async function reprendreFichiersJoints(fileIds: (string | null)[]): Promise<void> {
  await Promise.all(fileIds.filter((id): id is string => Boolean(id)).map(supprimerFichier));
}
