#!/usr/bin/env node
// Dépôt d'un fichier depuis le serveur, sans passer par l'API :
//
//   docker compose exec -T codialis.files upload png < photo.png
//
// Le `-T` n'est PAS facultatif : sans lui, `docker compose exec` alloue un
// pseudo-terminal, dont le traitement des caractères corrompt un flux binaire.
//
// L'extension est un argument parce que l'entrée standard ne transporte ni nom
// ni type. L'écriture passe par le même module que l'API : mêmes contrôles,
// même forme d'identifiant.

import { ErreurFichier, EXTENSIONS, enregistrer } from "../src/stockage.js";

const extension = process.argv[2];

if (!extension) {
  console.error(`Usage : upload <extension> < fichier
Extensions acceptées : ${EXTENSIONS.join(", ")}`);
  process.exit(2);
}

if (process.stdin.isTTY) {
  console.error("Rien sur l'entrée standard. Utiliser `docker compose exec -T …` puis `< mon-fichier`.");
  process.exit(2);
}

const morceaux = [];
for await (const morceau of process.stdin) morceaux.push(morceau);

try {
  // Seul l'identifiant part sur la sortie standard : la commande reste
  // utilisable dans un script (`id=$(… upload png < photo.png)`).
  console.log(await enregistrer(extension, Buffer.concat(morceaux)));
} catch (erreur) {
  console.error(erreur instanceof ErreurFichier ? erreur.message : String(erreur));
  process.exit(1);
}
