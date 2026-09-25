// Service de stockage de fichiers : DEUX serveurs HTTP dans un seul process,
// sur deux ports distincts.
//
//   3003  PUBLIC  — relayé par Traefik (files.codialis.com). Lecture seule.
//   3004  PRIVÉ   — aucun routeur Traefik, donc jamais joignable depuis
//                   Internet. Écriture et suppression, pour codialis.backend.
//
// Pourquoi deux ports ET un jeton : la séparation des ports ferme la porte du
// côté d'Internet, mais pas du côté du serveur. Toutes les webapps de l'agence
// partagent le réseau Docker `proxy`, et un process qui écoute sur 0.0.0.0
// écoute sur TOUTES ses interfaces — ajouter un réseau ne lui en retire aucune.
// Le jeton partagé avec codialis.backend est donc ce qui protège réellement les
// routes d'écriture des autres conteneurs du serveur.

import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

import {
  ErreurFichier,
  TAILLE_MAX,
  enregistrer,
  flux,
  idValide,
  supprimer,
  taille,
  typeMime,
} from "./stockage.js";

const PORT_PUBLIC = Number(process.env.FILES_PORT_PUBLIC || 3003);
const PORT_PRIVE = Number(process.env.FILES_PORT_PRIVE || 3004);
const JETON = process.env.FILES_TOKEN || "";
const URL_PUBLIQUE = (process.env.FILES_PUBLIC_URL || "https://files.codialis.com").replace(/\/+$/, "");

function repondre(reponse, code, corps) {
  const texte = JSON.stringify(corps);
  reponse.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(texte),
  });
  reponse.end(texte);
}

// Le chemin n'est jamais décodé : un identifiant valide ne contient que des
// hexadécimaux et un point, donc tout ce qui aurait besoin d'un décodage est
// par construction invalide.
function cheminDemande(requete) {
  return new URL(requete.url, "http://interne").pathname.slice(1);
}

// -- Serveur public : rendre un fichier ---------------------------------------

const serveurPublic = createServer(async (requete, reponse) => {
  if (requete.method !== "GET" && requete.method !== "HEAD") {
    return repondre(reponse, 405, { erreur: "Méthode non autorisée." });
  }

  const id = cheminDemande(requete);
  const octets = await taille(id);
  // Même réponse pour un identifiant mal formé et pour un fichier absent :
  // rien à apprendre de ce qui existe ou non.
  if (octets === null) return repondre(reponse, 404, { erreur: "Fichier introuvable." });

  reponse.writeHead(200, {
    "content-type": typeMime(id),
    "content-length": octets,
    // Le contenu d'un identifiant ne change JAMAIS : un nouvel envoi crée un
    // nouvel identifiant. Le cache peut donc être définitif.
    "cache-control": "public, max-age=31536000, immutable",
    // Le type est déduit de l'extension et jamais de ce qu'annonçait le client.
    // `nosniff` empêche le navigateur de le redeviner à partir du contenu.
    "x-content-type-options": "nosniff",
    // Les images sont affichées par le back-office, sur une autre origine.
    "access-control-allow-origin": "*",
  });

  if (requete.method === "HEAD") return reponse.end();
  flux(id).pipe(reponse);
});

// -- Serveur privé : déposer et supprimer -------------------------------------

function jetonValide(recu) {
  if (!JETON || typeof recu !== "string") return false;
  const attendu = Buffer.from(JETON);
  const fourni = Buffer.from(recu);
  // Comparaison à temps constant : une comparaison de chaînes s'arrête au
  // premier caractère différent, ce qui laisse deviner le jeton octet par octet.
  return fourni.length === attendu.length && timingSafeEqual(fourni, attendu);
}

function lireCorps(requete) {
  return new Promise((resoudre, rejeter) => {
    const morceaux = [];
    let total = 0;
    let tropLourd = false;

    requete.on("data", (morceau) => {
      total += morceau.length;
      // Au-delà de la limite on JETTE les morceaux sans cesser de lire, plutôt
      // que de tout accumuler puis refuser : la mémoire reste bornée, et
      // l'appelant reçoit un message d'erreur en bonne et due forme. Couper la
      // connexion en cours d'envoi lui vaudrait une connexion réinitialisée,
      // sans rien pour comprendre ce qui s'est passé.
      if (total > TAILLE_MAX) {
        tropLourd = true;
        morceaux.length = 0;
        return;
      }
      morceaux.push(morceau);
    });

    requete.on("end", () => {
      if (tropLourd) return rejeter(new ErreurFichier("Fichier trop lourd."));
      resoudre(Buffer.concat(morceaux));
    });
    requete.on("error", rejeter);
  });
}

const serveurPrive = createServer(async (requete, reponse) => {
  if (!jetonValide(requete.headers["x-files-token"])) {
    return repondre(reponse, 401, { erreur: "Jeton absent ou invalide." });
  }

  const url = new URL(requete.url, "http://interne");

  try {
    if (requete.method === "POST" && url.pathname === "/upload") {
      const id = await enregistrer(url.searchParams.get("ext"), await lireCorps(requete));
      return repondre(reponse, 201, { id, url: `${URL_PUBLIQUE}/${id}` });
    }

    if (requete.method === "DELETE") {
      const id = cheminDemande(requete);
      if (!idValide(id)) return repondre(reponse, 400, { erreur: "Identifiant invalide." });
      await supprimer(id);
      return repondre(reponse, 200, { ok: true });
    }
  } catch (erreur) {
    if (erreur instanceof ErreurFichier) return repondre(reponse, 400, { erreur: erreur.message });
    console.error("[files] échec de l'opération privée :", erreur);
    return repondre(reponse, 500, { erreur: "Le stockage a échoué." });
  }

  return repondre(reponse, 404, { erreur: "Route inconnue." });
});

// -- Démarrage ----------------------------------------------------------------

// Refus de démarrer sans jeton plutôt que de servir des routes d'écriture
// ouvertes : une erreur de configuration doit se voir tout de suite.
if (!JETON) {
  console.error("[files] FILES_TOKEN manquant : les routes privées seraient ouvertes. Arrêt.");
  process.exit(1);
}

serveurPublic.listen(PORT_PUBLIC, () => console.log(`[files] lecture publique sur ${PORT_PUBLIC}`));
serveurPrive.listen(PORT_PRIVE, () => console.log(`[files] écriture privée sur ${PORT_PRIVE}`));
