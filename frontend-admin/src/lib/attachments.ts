// Ce que le stockage accepte en pièce jointe. Aligné sur files/src/stockage.js
// et backend/src/lib/files.ts : le service est le seul vrai juge, cette liste
// sert à prévenir AVANT d'envoyer 20 Mo pour rien, et à filtrer le sélecteur.
//
// Module sans directive : importable aussi bien par un composant serveur que
// par le composant client qui gère le collage et le glisser-déposer.

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif"] as const;
export const DOCUMENT_EXTENSIONS = ["pdf", "docx", "xlsx", "pptx", "odt", "ods", "zip", "txt", "csv"] as const;
export const ACCEPTED_EXTENSIONS: readonly string[] = [...IMAGE_EXTENSIONS, ...DOCUMENT_EXTENSIONS];

// Valeur de l'attribut `accept` d'un `<input type="file">`.
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(",");

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

// L'identifiant du fichier stocké porte son extension (DEC-028) : l'adresse
// publique suffit à savoir s'il s'agit d'une image.
export function isImageUrl(url: string): boolean {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(extensionOf(url));
}
