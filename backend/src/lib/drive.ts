import "server-only";

// Pièces jointes stockées dans Google Drive.
//
// Pas de SDK : Node fournit `fetch`, et le projet appelle déjà Brevo et Gemini
// de la même façon. Une dépendance de moins à suivre.
//
// Authentification : OAuth 2.0 avec un refresh token, pas un compte de service.
// Un compte de service n'a PAS de stockage propre et ne peut pas posséder de
// fichier — il lui faudrait un Drive partagé, donc Google Workspace, que
// l'agence n'a pas. Le consentement se fait une fois (voir
// prisma/drive-consent.ts), et le refresh token vaut tant que l'application
// OAuth est publiée « en production ».
//
// Le scope demandé est `drive.file` : l'application ne voit QUE les fichiers
// qu'elle a créés. C'est suffisant ici, et cela évite la revue de sécurité que
// Google impose aux scopes restreints.

const TOKEN_URL = () => process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const API_URL = () => process.env.GOOGLE_DRIVE_API_URL || "https://www.googleapis.com/drive/v3";
const UPLOAD_URL = () =>
  process.env.GOOGLE_DRIVE_UPLOAD_URL || "https://www.googleapis.com/upload/drive/v3";

// Au-delà, on refuse : les 15 Go d'un compte gratuit partent vite, et une pièce
// jointe de ticket n'a pas vocation à peser davantage.
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export function driveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN,
  );
}

// Le jeton d'accès vaut une heure. On le garde en mémoire du processus plutôt
// que d'en redemander un à chaque fichier, avec une marge pour ne pas s'en
// servir à la seconde près.
let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? "",
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google OAuth ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Google OAuth : aucun jeton d'accès renvoyé");

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

// Dossier de dépôt. `GOOGLE_DRIVE_FOLDER_ID` le fige une fois pour toutes ;
// sans lui, on en crée un au premier envoi et on le retient pour la durée du
// processus. Avec `drive.file`, l'application ne retrouve que ses propres
// dossiers : il n'y a pas de risque de tomber sur celui de quelqu'un d'autre.
let folderId: string | null = null;

async function targetFolder(token: string): Promise<string | undefined> {
  const configured = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (configured) return configured;
  if (folderId) return folderId;

  const res = await fetch(`${API_URL()}/files`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      name: "Codialis — pièces jointes",
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!res.ok) return undefined; // Sans dossier, le fichier ira à la racine.
  const data = (await res.json()) as { id?: string };
  folderId = data.id ?? null;
  return folderId ?? undefined;
}

export type UploadedFile = { id: string; name: string; mimeType: string; size: number };

// Envoi en multipart : métadonnées et contenu dans une seule requête. Suffisant
// jusqu'à quelques dizaines de mégaoctets — au-delà Google veut un envoi
// reprenable, mais notre plafond est à 25 Mo.
export async function uploadFile(args: {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<UploadedFile> {
  if (!driveConfigured()) throw new Error("Google Drive n'est pas configuré");
  if (args.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error("Fichier trop lourd");
  }

  const token = await accessToken();
  const parent = await targetFolder(token);
  const mimeType = args.mimeType || "application/octet-stream";

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify({ name: args.filename, parents: parent ? [parent] : undefined })], {
      type: "application/json",
    }),
  );
  form.append("file", new Blob([args.bytes as BlobPart], { type: mimeType }));

  const res = await fetch(`${UPLOAD_URL()}/files?uploadType=multipart&fields=id,name,mimeType,size`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google Drive ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id: string; name: string; mimeType: string; size?: string };
  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType,
    size: Number(data.size ?? args.bytes.byteLength),
  };
}

// Le contenu ne sort jamais en lien direct : il transite par une route du
// backend qui vérifie d'abord la session. Les fichiers restent privés côté
// Drive, personne n'y accède sans passer par l'application.
export async function downloadFile(fileId: string): Promise<Response> {
  if (!driveConfigured()) throw new Error("Google Drive n'est pas configuré");
  const token = await accessToken();
  return fetch(`${API_URL()}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

// La suppression ne doit jamais faire échouer l'action qui l'a déclenchée : un
// fichier resté dans Drive est un désagrément, une suppression de ticket qui
// échoue est un blocage.
export async function deleteFile(fileId: string): Promise<void> {
  if (!driveConfigured()) return;
  try {
    const token = await accessToken();
    const res = await fetch(`${API_URL()}/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    // 404 : déjà parti, c'est le résultat voulu.
    if (!res.ok && res.status !== 404) {
      console.error(`Suppression Drive en échec (${fileId}) :`, res.status);
    }
  } catch (err) {
    console.error(`Suppression Drive en échec (${fileId}) :`, err);
  }
}
