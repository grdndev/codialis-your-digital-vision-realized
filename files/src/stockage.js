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

// Images uniquement (arbitrage du 22/09). Le SVG est volontairement ABSENT :
// c'est du HTML exécutable, donc un XSS stocké déguisé en image.
const TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

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
// vraiment. Sans cela « images uniquement » ne serait qu'une politesse : un
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
    throw new ErreurFichier(`Le contenu n'est pas une image ${extension}.`);
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
