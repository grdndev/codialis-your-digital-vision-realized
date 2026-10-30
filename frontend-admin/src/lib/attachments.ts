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

// Une capture collée s'appelle « image.png » : le nom ne dirait rien dans la
// liste. On la date, à l'heure de la personne qui colle.
export function withCaptureName(file: File): File {
  if (file.name && !/^image\.\w+$/i.test(file.name)) return file;
  const ext = extensionOf(file.name) || file.type.split("/")[1] || "png";
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}h${pad(now.getMinutes())}m${pad(now.getSeconds())}`;
  return new File([file], `capture-${stamp}.${ext}`, { type: file.type });
}

// Le stockage refuse de toute façon ; vérifier ici évite d'envoyer 20 Mo pour
// rien et répond tout de suite.
export function attachmentRefusal(file: File): string | null {
  if (file.size === 0) return "le fichier est vide";
  if (file.size > MAX_ATTACHMENT_BYTES) return "fichier trop lourd (25 Mo maximum)";
  if (!ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))) {
    return `type refusé (acceptés : images, ${DOCUMENT_EXTENSIONS.join(", ")})`;
  }
  return null;
}
