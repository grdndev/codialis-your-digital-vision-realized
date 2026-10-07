// Ce qu'est un fichier stocké : lecture, écriture, suppression, validation.
//
// Module partagé par le serveur HTTP et par la commande `upload`. Il n'existe
// donc qu'UNE seule définition de ce qui est acceptable, et un fichier déposé
// en ligne de commande est exactement un fichier déposé par l'API.
//
// L'identifiant EST le nom du fichier sur disque : `<32 hexadécimaux>.<ext>`.
// Aucun index, aucune base de données. C'est ce qui rend le dépôt manuel
// possible sans commande d'enregistrement, et la suppression manuelle aussi :
// il n'y a jamais de référence à réconcilier.

import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Erreur dont le message est destiné à l'utilisateur, par opposition à un
// défaut technique qu'on ne veut pas lui montrer.
export class ErreurFichier extends Error {}

export const DOSSIER = process.env.FILES_DIR || "/app/public";

// Images, et depuis le 07/10 les documents qu'on joint à un ticket (PDF,
// bureautique, archive, texte) : la fiche ticket accepte « un fichier ou une
// capture d'écran ». Liste blanche, chaque type avec sa signature vérifiée.
//
// Sont volontairement ABSENTS tous les formats que le navigateur exécute : le
// SVG (du HTML déguisé en image), le HTML, le JavaScript. Le texte brut est
// servi en `text/plain` avec `nosniff` : il s'affiche, il ne s'exécute pas.
const TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  zip: "application/zip",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
};

const IMAGES = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);

// Une image ou un PDF s'affiche dans le navigateur ; le reste se télécharge.
export function sAfficheDansLeNavigateur(id) {
  const extension = id.slice(id.lastIndexOf(".") + 1);
  return IMAGES.has(extension) || extension === "pdf";
}

export const EXTENSIONS = Object.keys(TYPES);

export const TAILLE_MAX = Number(process.env.FILES_MAX_BYTES || 25 * 1024 * 1024);

// Un identifiant finit dans un chemin de fichier : cette expression est la
// SEULE chose qui empêche `../../etc/passwd`. Liste blanche de caractères,
// jamais une recherche de « .. » qui laisserait passer un encodage.
const FORMAT_ID = new RegExp(`^[0-9a-f]{32}\\.(${EXTENSIONS.join("|")})$`);

export function idValide(id) {
  return typeof id === "string" && FORMAT_ID.test(id);
}

export function typeMime(id) {
  return TYPES[id.slice(id.lastIndexOf(".") + 1)] ?? "application/octet-stream";
}

function chemin(id) {
  return join(DOSSIER, id);
}

// Le client annonce une extension ; on vérifie que le contenu lui ressemble
// vraiment. Sans cela la liste blanche ne serait qu'une politesse : un
// exécutable renommé `.png` serait accepté et servi.
function signatureCorrespond(extension, contenu) {
  const debutVaut = (position, texte) =>
    contenu.toString("latin1", position, position + texte.length) === texte;

  switch (extension) {
    case "png":
      return contenu.length > 8 && debutVaut(0, "\x89PNG\r\n\x1a\n");
    case "jpg":
    case "jpeg":
      return contenu.length > 3 && contenu[0] === 0xff && contenu[1] === 0xd8 && contenu[2] === 0xff;
    case "gif":
      return contenu.length > 6 && debutVaut(0, "GIF8");
    case "webp":
      return contenu.length > 12 && debutVaut(0, "RIFF") && debutVaut(8, "WEBP");
    // Un AVIF est un conteneur ISO-BMFF : la marque de format est en position 4.
    case "avif":
      return contenu.length > 12 && debutVaut(4, "ftyp");
    case "pdf":
      return contenu.length > 5 && debutVaut(0, "%PDF-");
    // Les formats bureautiques modernes SONT des archives zip.
    case "docx":
    case "xlsx":
    case "pptx":
    case "odt":
    case "ods":
    case "zip":
      return contenu.length > 4 && debutVaut(0, "PK\x03\x04");
    // Du texte n'a pas de signature : on refuse au moins ce qui est binaire.
    // Un octet nul n'apparaît dans aucun texte UTF-8.
    case "txt":
    case "csv":
      return !contenu.subarray(0, 64 * 1024).includes(0);
    default:
      return false;
  }
}

function enMegaoctets(octets) {
  return (octets / (1024 * 1024)).toFixed(1).replace(".", ",");
}

export function normaliserExtension(valeur) {
  return String(valeur ?? "").trim().toLowerCase().replace(/^\./, "");
}

// Écrit le contenu et rend son identifiant.
export async function enregistrer(extensionDemandee, contenu) {
  const extension = normaliserExtension(extensionDemandee);

  if (!(extension in TYPES)) {
    throw new ErreurFichier(
      `Extension « ${extension || "(vide)"} » refusée. Acceptées : ${EXTENSIONS.join(", ")}.`,
    );
  }
  if (contenu.length === 0) {
    throw new ErreurFichier("Le fichier est vide.");
  }
  if (contenu.length > TAILLE_MAX) {
    throw new ErreurFichier(
      `Fichier trop lourd (${enMegaoctets(contenu.length)} Mo), maximum ${enMegaoctets(TAILLE_MAX)} Mo.`,
    );
  }
  if (!signatureCorrespond(extension, contenu)) {
    throw new ErreurFichier(`Le contenu ne correspond pas à un fichier ${extension}.`);
  }

  const id = `${randomBytes(16).toString("hex")}.${extension}`;

  // Écriture sous un nom provisoire puis renommage : `rename` est atomique sur
  // un même système de fichiers. Un process tué en pleine écriture ne laisse
  // donc jamais un fichier à moitié écrit sous un identifiant servable.
  const provisoire = join(DOSSIER, `.tmp-${randomBytes(8).toString("hex")}`);
  await writeFile(provisoire, contenu);
  try {
    await rename(provisoire, chemin(id));
  } catch (erreur) {
    await unlink(provisoire).catch(() => {});
    throw erreur;
  }

  return id;
}

// Rend la taille du fichier, ou null s'il n'existe pas.
export async function taille(id) {
  if (!idValide(id)) return null;
  try {
    const infos = await stat(chemin(id));
    return infos.isFile() ? infos.size : null;
  } catch {
    return null;
  }
}

export function flux(id) {
  return createReadStream(chemin(id));
}

// Rend true si le fichier existait, false s'il avait déjà disparu. Supprimer
// deux fois n'est pas une erreur : l'appelant veut seulement qu'il n'y soit plus.
export async function supprimer(id) {
  if (!idValide(id)) throw new ErreurFichier("Identifiant invalide.");
  try {
    await unlink(chemin(id));
    return true;
  } catch (erreur) {
    if (erreur.code === "ENOENT") return false;
    throw erreur;
  }
}
