# CLAUDE.md — Codialis (site vitrine, back-office, API)
format=llm-compact | un fait par ligne | DEC+TRAP append-only | STATE réécrit

## REF
readme=README.md  role=architecture des trois applications et démarrage local
readme_fonctionnalites=ABSENT  why=le découpage BxFy n'a jamais été rédigé, à faire valider avant de le créer
cdc=liste de tickets en production, projet « Codialis CRM », références CC-3xx  cdc_lecture=admin.codialis.com → Tickets
cdc_date=continu  sync=2026-09-17

## STACK
next=16.3.3 react=19.2.8 typescript=5 tailwindcss=4 eslint=9
prisma=6.19.3 @prisma/client=6.19.3 zod=4 jose=6 bcryptjs=3
db_prod=mysql:8.4  db_test_local=mariadb-10.6
tz=Indian/Reunion(UTC+4)
env=local → frontend-public:3001 frontend-admin:3002 backend:3001(interne, relayé par Apache)
env=prod → landingback.codialis.com(API) admin.codialis.com(back-office) files.codialis.com(fichiers) codialis.com(vitrine, Hostinger)
prod_ssh=ubuntu@135.125.254.251:~/codialis
prod_services=codialis.db(codialis-db) codialis.backend(codialis-api) codialis.admin(codialis-admin) codialis.files(codialis-files)

## CMD
typecheck=npx tsc --noEmit  scope=backend et frontend-admin séparément
lint=./node_modules/.bin/eslint src  why=`npx eslint` échoue hors du dossier de l'app
build=npx next build
test_calcul=npx tsx prisma/test-work-time.ts | npx tsx prisma/test-work-calendar.ts | npx tsx prisma/test-hr-calendar.ts
seed_test=DATABASE_URL=… npx tsx prisma/seed-test.ts  DANGER=local uniquement, vide la base avant de semer
migrate_local=DATABASE_URL=… npx prisma migrate dev --name … --skip-seed
migrate_prod=docker compose exec codialis.backend npx prisma migrate deploy
deploy=ssh prod → cd ~/codialis && git pull --ff-only && docker compose up -d --build
upload_manuel=docker compose exec -T codialis.files upload png < photo.png  why=le -T est obligatoire, voir TRAP-020
db_local_start=mariadbd --datadir=/tmp/cdl-db --socket=/tmp/cdl.sock --port=3399 --pid-file=/tmp/cdl.pid
frontend_public_deploy=MANUEL, hébergement Hostinger, aucun accès depuis ici

## CONV
statut_ticket=EN_COURS dès qu'on commence à travailler dessus, EN_REVUE à la livraison, JAMAIS TERMINE soi-même why=le tableau sert à voir qui fait quoi, et c'est au demandeur de constater que c'est bon
langue=français pour tout : code, commentaires, messages d'erreur, libellés, messages de commit
commentaires=denses et explicatifs, ils disent POURQUOI ; s'aligner sur l'existant plutôt que sur la règle « aucun commentaire »
mutations_api=une seule route POST par écran, zod `discriminatedUnion("action", …)`
routes_admin=adminRoute([roles], async ({ user }, request) => …) ; une mutation sans retour répond `{ ok: true }`
erreurs=badRequest(message) lisible par l'utilisateur, jamais un code technique
dates_bureau=minutes depuis minuit (heure locale de bureau), pas d'instant, pas de fuseau
refs=maxSuffix + withUniqueRef (lib/refs.ts), jamais dérivées d'un COUNT
nombres_saisis=parseNumber (frontend-admin/src/lib/format.ts), jamais parseFloat
libelle_projet=projectLabel(client, projet), jamais `client — projet` en dur
tests=script assertif dans prisma/test-*.ts (calcul pur) ou dans le scratchpad (bout en bout HTTP) ; pas de framework de test dans le repo

## MAP
backend/src/app/api/admin/=API du back-office, une route par écran
backend/src/app/api/auth/=connexion, mot de passe, vérification de compte
backend/src/app/api/{contact,content,newsletter,settings,health}/=routes publiques du site vitrine
backend/src/lib/admin-api.ts=adminRoute, badRequest, jsonBody, prismaError
backend/src/lib/project-access.ts=ce qu'un DEV a le droit de voir d'un projet (règle unique, partagée)
backend/src/lib/work-time.ts=calcul pur du temps mesuré (rognage horaires + partage entre tâches parallèles)
backend/src/lib/work-sessions.ts=ouverture/fermeture des chronomètres et recalcul des compteurs
backend/src/lib/hr-calendar.ts=étalement des absences et règles récurrentes sur des jours
backend/src/lib/balances.ts=soldes de congés et d'heures, calculés jamais stockés
backend/src/lib/work-calendar.ts=jours ouvrés, fériés français, isoOf
backend/src/lib/refs.ts=attribution des références lisibles
backend/src/lib/files.ts=client de codialis.files (envoi, suppression, url publique) ; seul le backend connaît le port privé et le jeton
backend/src/app/api/admin/attachments/=pièces jointes : POST = le fichier BRUT en corps, DELETE = retrait ; hors convention « une route par écran » parce que ce n'est pas du JSON
backend/prisma/schema.prisma=schéma unique
backend/prisma/seed-test.ts=jeu d'essai local
backend/prisma/import-asana.ts=import ponctuel des exports Asana
frontend-admin/src/app/(app)/=écrans internes, un dossier par écran, actions.ts + types.ts + page.tsx
frontend-admin/src/app/(client)/portal/=portail client
frontend-admin/src/lib/api.ts=apiGet/apiPost, relais du Bearer, réanimation des dates ISO
frontend-admin/src/lib/nav.ts=menu et rôles autorisés par écran
frontend-admin/src/app/(app)/attachments.tsx=bloc « Pièces jointes » partagé par la fiche ticket et la fiche tâche
frontend-admin/src/proxy.ts=garde de session + mémoire d'écran (filtres, dernier projet)
files/src/stockage.js=ce qu'est un fichier stocké (validation, écriture, suppression), partagé serveur+CLI
files/src/serveur.js=deux serveurs HTTP dans un process : 3003 lecture publique, 3004 écriture privée
files/bin/upload.js=dépôt en ligne de commande depuis le serveur
files/public/=volume des fichiers déposés, vide dans le dépôt
frontend-public/=site vitrine statique, déployé à la main sur Hostinger
entry=backend/src/app/api/admin/*/route.ts et frontend-admin/src/app/(app)/*/page.tsx

## DEC
DEC-001 [2026-09-17] ACTIVE les droits sont appliqués par l'API, jamais par l'écran why=les gardes de frontend-admin n'évitent que d'afficher, elles ne protègent pas les données alt=confiance au frontend
DEC-002 [2026-09-17] SUPERSEDED-BY:DEC-014 un DEV accède à un projet s'il y est affecté OU y porte un ticket OU une tâche why=donner du travail sans affecter est courant alt=affectation seule (état initial, à l'origine de CC-337)
DEC-003 [2026-09-17] ACTIVE le temps passé est MESURÉ depuis les changements de statut, pas déclaré why=demande CC-330 ; la saisie manuelle subsiste pour ce qui ne relève d'aucune tâche alt=saisie manuelle seule
DEC-004 [2026-09-17] ACTIVE spentHours/hoursSpent sont RECALCULÉS, plus incrémentés why=la part d'une session dépend des autres tâches menées en parallèle, un incrément ne peut pas rester juste alt=compteurs incrémentaux (dérivaient à chaque correction)
DEC-005 [2026-09-17] ACTIVE le temps s'impute à l'ASSIGNÉ, pas à qui clique why=demande utilisateur ; un tiers qui démarre est averti à l'écran alt=imputer à l'acteur
DEC-006 [2026-09-17] ACTIVE tous les statuts sont atteignables, y compris en arrière why=arrêter une tâche ne doit pas obliger à la déclarer livrée alt=enchaînement à sens unique
DEC-007 [2026-09-17] ACTIVE clôturer un ticket (TERMINE) est réservé à PM et DIR why=CC-329, c'est au demandeur de constater que c'est bon alt=tout le monde clôture
DEC-008 [2026-09-17] ACTIVE la mémoire d'écran vit dans proxy.ts (cookies), pas dans un composant why=un Server Component ne peut pas écrire de cookie alt=état client, localStorage
DEC-009 [2026-09-17] ACTIVE le calendrier RH est visible par toute l'équipe, le MOTIF reste à la direction why=savoir qui est absent est le minimum pour s'organiser alt=calendrier réservé à DIR — À FAIRE CONFIRMER
DEC-010 [2026-09-17] ACTIVE l'import JSON d'un projet est réservé à PM et DIR why=poser la structure d'un projet est la même main que le créer alt=ouvert aux DEV
DEC-011 [2026-09-17] ACTIVE la référence d'un ticket CHANGE quand il change de projet why=arbitrage utilisateur explicite ; une référence porte le projet alt=référence figée (état initial)
DEC-012 [2026-09-17] ACTIVE les pièces jointes passent par Google Drive (scope drive.file), pas par un stockage maison why=rien à héberger ni à sauvegarder alt=fichiers sur le serveur, base64 en base
DEC-013 [2026-09-17] ACTIVE emails transactionnels via Brevo en `fetch` brut, sans SDK why=même parti pris que Gemini et Drive, une dépendance de moins alt=SDK officiel
DEC-014 [2026-09-17] SUPERSEDED-BY:DEC-023 AUCUN cloisonnement interne : DEV, PM et DIR voient tous les projets, tickets, tâches et ressources why=arbitrage Denis ; ProjectAssignment n'a jamais été écrite par aucun écran, la table est vide en prod, la règle ne masquait donc des projets qu'à tout le monde alt=affectation par projet (DEC-002), ANNULE CC-338 — à signaler à Jayan et Gabrielle
DEC-015 [2026-09-17] ACTIVE les restrictions d'ÉCRITURE demeurent (clôture PM/DIR, import JSON PM/DIR, création client/projet PM/DIR) why=DEC-014 ne porte que sur la lecture alt=tout ouvrir
DEC-016 [2026-09-18] ACTIVE l'écran Tickets filtre « assigné à » sur Moi PAR DÉFAUT why=on l'ouvre pour voir ce qu'on a à faire, pas les 236 tickets de l'agence ; le défaut ne s'écrit pas dans l'adresse alt=aucun filtre par défaut
DEC-018 [2026-09-18] ACTIVE la page Programme partenaire est une page HTML simple du site (gabarit des pages d'expertise), pas le bundle React livré why=elle doit hériter du bandeau, du pied de page, des couleurs et des polices du site, et le bundle autonome ne le permettait pas alt=publier le bundle tel quel (design divergent, sans titre, formulaire qui n'envoie rien)
DEC-020 [2026-09-21] ACTIVE les tâches internes sont ouvertes à toute l'équipe, chacun peut s'en poser une ou en confier une à n'importe quel collègue why=CC-344 ; elles étaient réservées à DIR, qui ne pouvait les confier qu'à un PM alt=distribution réservée à la direction
DEC-021 [2026-09-21] ACTIVE la recherche des tickets n'est PAS retenue d'une visite à l'autre, contrairement aux filtres why=retrouver l'écran avec les mots tapés la semaine dernière n'aide personne ; `q` est retiré du cookie de mémoire d'écran alt=tout retenir
DEC-022 [2026-09-21] ACTIVE créer un ticket depuis une fiche projet rouvre le formulaire sur ce projet ; depuis l'écran Tickets, on va sur le ticket créé why=CC-340, on signale plusieurs bugs d'affilée depuis un projet alt=toujours rediriger vers le ticket
DEC-019 [2026-09-18] ACTIVE la candidature partenaire part dans /api/contact, profil et niveau dans le message why=elle atterrit ainsi dans « Demandes de Contact » du back-office sans toucher au schéma alt=nouvelle table et nouvelle route
DEC-023 [2026-09-21] ACTIVE un DEV ne voit que les projets où il a du travail ASSIGNÉ : au moins une tâche ou un ticket à son nom why=arbitrage Denis du 21/09, reprend la lecture que DEC-014 avait ouverte en entier ; l'assignation est la seule chose que les écrans écrivent vraiment, contrairement à ProjectAssignment (TRAP-014) alt=tout ouvert (DEC-014), affectation par projet (DEC-002)
DEC-024 [2026-09-21] ACTIVE portée de DEC-023 : écran Projets, fiche projet appelée par son adresse, tableau de bord, et filtres de projet de l'écran Tickets quand « assigné à moi » est demandé why=une liste réduite mais un projet lisible par son adresse ne cloisonne rien ; la LISTE DES TICKETS, elle, reste ouverte à toute l'équipe alt=filtrer seulement la liste des projets
DEC-025 [2026-09-21] ACTIVE les heures supplémentaires se DÉCLARENT en RH (HoursEntry, validées par la direction), elles ne se règlent plus en plage horaire dans Paramètres why=demande du 21/09 ; une plage réglée d'avance comptait une soirée toutes les semaines, sans validation et sans solde alt=plage horaire dans les horaires de travail (colonnes overtime*, supprimées)
DEC-026 [2026-09-21] ACTIVE la phase d'un projet se change depuis l'EN-TÊTE du projet, pour PM et DIR why=elle ne vivait que dans « Modifier le projet », replié, dans l'onglet Fiche : la chefferie ne la trouvait pas, alors que l'API l'autorisait déjà alt=le formulaire complet seul
DEC-017 [2026-09-18] ACTIVE les 162 remontées client sont devenues des tickets ordinaires TERMINE/CLOS, marqueur `clientReported` retiré why=arbitrage Denis du 18/09 ; la file de triage est vidée alt=ne fermer que le triage en gardant le marqueur (préservait l'écran Bugs du portail client) — sauvegarde ~/backups/remontees-client/avant-20260918-060340.json, restaurable par `npx tsx prisma/close-client-reports.ts --restore=`
DEC-027 [2026-09-22] ACTIVE les fichiers sont stockés par un service maison `codialis.files` (volume Docker), destiné à REMPLACER Google Drive why=rien à demander à Google, pas de projet Cloud ni de consentement OAuth à obtenir, ce qui débloque CC-302 alt=Google Drive (DEC-012, conservé le temps de la cohabitation)
DEC-028 [2026-09-22] ACTIVE l'identifiant d'un fichier EST son nom sur disque (`<32 hexa>.<ext>`), aucun index ni base why=un fichier déposé à la main dans le volume est servi immédiatement, sans commande d'enregistrement, et le supprimer suffit à le faire disparaître alt=identifiant opaque + index à tenir à jour
DEC-029 [2026-09-22] ACTIVE les routes d'écriture de codialis.files sont protégées par DEUX ports (3003 public relayé par Traefik, 3004 privé sans routeur) ET un jeton partagé FILES_TOKEN why=les ports ferment la porte côté Internet mais pas côté serveur : toutes les webapps de l'agence partagent le réseau `proxy`, et un process qui écoute sur 0.0.0.0 écoute sur toutes ses interfaces alt=réseau Docker séparé (n'enlève aucune interface au process), contrôle d'en-tête Origin (falsifiable)
DEC-030 [2026-09-22] ACTIVE codialis.files n'accepte que des images, SVG EXCLU, et vérifie la signature binaire du contenu why=un SVG est du HTML exécutable, donc un XSS stocké déguisé en image ; sans contrôle de signature la liste blanche d'extensions n'est qu'une politesse alt=tout type de fichier
DEC-031 [2026-09-23] ACTIVE la chefferie (PM) gère les COMPTES au même titre que la direction : même onglet, mêmes droits, y compris changer un rôle why=demande du 23/09 ; la gestion des comptes était le dernier écran réservé à DIR alors que le PM recrute et fait entrer les gens alt=lecture seule pour le PM, création sans changement de rôle
DEC-032 [2026-09-23] ACTIVE supprimer un compte ne DÉTRUIT rien de ce qu'il a produit : commentaires, notes, messages, décisions, catégories et saisies de temps lui survivent sans auteur (colonne à NULL), tâches et tickets se désassignent why=arbitrage Denis du 23/09 ; un `authorId` obligatoire rendait indestructible tout compte ayant écrit une seule ligne, et l'échec s'affichait en « Référence introuvable » alt=cascade (perte de l'historique), compte désactivé au lieu de supprimé, anonymisation vers un compte « Compte supprimé »
DEC-033 [2026-09-23] ACTIVE seule exception à DEC-032 : TeamProfitSnapshot part en CASCADE avec le compte why=c'est la rentabilité DE la personne, période par période ; une ligne sans personne n'est pas un historique, c'est du bruit dans l'écran Pilotage alt=le garder sans utilisateur comme le reste
DEC-034 [2026-09-25] ACTIVE le navigateur n'écrit JAMAIS dans codialis.files : il envoie le fichier à frontend-admin, qui le relaie au backend, qui seul détient le port privé et le jeton ; la LECTURE, elle, est directe depuis files.codialis.com why=demande initiale du 22/09 ; faire transiter chaque image par deux serveurs Next à l'affichage serait payer deux fois pour rien alt=envoi direct navigateur → stockage (il faudrait exposer le jeton), lecture relayée par le backend
DEC-035 [2026-09-25] ACTIVE les pièces jointes ont leur propre route (/api/admin/attachments), hors de la convention « une seule route POST par écran » why=le corps n'est pas du JSON mais le fichier brut ; la destination passe donc par l'adresse, et le retrait par DELETE alt=base64 dans le JSON de la route d'écran (33 % de plus, et 25 Mo deviennent 33)

## TRAP
TRAP-001 le serveur `next dev` garde l'ANCIEN client Prisma après une migration → le redémarrer, sinon « Cannot read properties of undefined » sur le nouveau modèle
TRAP-002 MySQL trie les NULL EN TÊTE et Prisma n'expose pas `nulls:"last"` sur ce connecteur → trier en JS (fait pour la gravité des tickets)
TRAP-003 `sort_buffer_size` par défaut fait échouer un ORDER BY qui embarque une colonne TEXT lourde (erreur 1038) → classer sur les colonnes légères puis relire le contenu
TRAP-004 `parseFloat("1 500")` vaut 1 → toujours `parseNumber`, sinon les montants tombent à 1 € (CC-324)
TRAP-005 le chemin d'une socket unix est limité à ~107 caractères → socket de test dans /tmp, pas dans le scratchpad de session
TRAP-006 `pkill -f "next dev -p 3401"` tue le shell qui lance la commande (le motif matche sa propre ligne de commande) → `fuser -k 3401/tcp`
TRAP-007 `npx eslint` échoue hors du dossier de l'app (config introuvable) → `./node_modules/.bin/eslint src` depuis backend/ ou frontend-admin/
TRAP-008 le site vitrine teste `location.port === '3001'` pour appeler /api en relatif → ne pas changer le port local de frontend-public
TRAP-009 frontend-public n'est PAS dans docker-compose, il est sur Hostinger → une modification n'est jamais déployée par le pipeline, le signaler à l'utilisateur
TRAP-010 le shadow database de `prisma migrate dev` exige des droits étendus → GRANT ALL ON *.* … WITH GRANT OPTION sur la base de test
TRAP-011 `monthEnd` des routes RH est une borne EXCLUSIVE → le dernier jour affiché est la veille
TRAP-012 les bornes de période du planning RH sont décidées par l'ÉCRAN et non recalculées côté API → un créneau se retrouve par égalité exacte de date, tout recalcul le ferait disparaître
TRAP-013 le conteneur codialis-api affiche un avertissement OpenSSL de Prisma sur chaque commande node → bruit, pas une erreur
TRAP-014 ProjectAssignment n'est écrite QUE par les seeds, jamais par l'application → ne fonder aucune règle dessus sans construire d'abord l'écran qui la remplit (a produit des 404 inexplicables sur des tickets existants)
TRAP-015b `clientReported` alimente DEUX écrans : le triage interne ET la liste « Bugs » du portail client → le retirer vide aussi ce que le client voit de ses propres signalements
TRAP-017 le premier `button[type=submit]` d'une page du back-office est celui de la DÉCONNEXION (barre du haut) → viser le formulaire par un de ses champs (`champ.closest("form")`), sinon un test se déconnecte et atterrit sur /login
TRAP-016 une case cochée par JavaScript ne déclenche aucun évènement → après un « tout sélectionner », réémettre un `change` depuis une case pour que React recompte
TRAP-018 le cloisonnement des projets (DEC-023) repose sur l'ASSIGNATION d'une tâche ou d'un ticket → retirer l'assignée d'un ticket fait disparaître le projet de sa liste ; c'est voulu, mais ça surprend
TRAP-019 le formulaire d'horaires envoie 0 pour dimanche alors que parseWeekdays attend l'ISO 1..7 → dimanche coché est silencieusement ignoré (samedi, 6, fonctionne)
TRAP-015 un cloisonnement de lecture se teste avec un compte qui n'a RIEN (ni affectation, ni tâche, ni ticket) → le jeu d'essai donnait du travail aux deux développeurs sur les deux projets, ce qui masquait le défaut
TRAP-020 `docker compose exec` alloue un pseudo-terminal par défaut, qui corrompt un flux binaire → `docker compose exec -T codialis.files upload png < photo.png`, le -T n'est pas facultatif
TRAP-021 `env_file: files/.env` fait ÉCHOUER `docker compose up` si le fichier n'existe pas → le créer sur le serveur avant le premier déploiement, sinon toute la pile refuse de monter
TRAP-022 codialis.files refuse de démarrer sans FILES_TOKEN → c'est volontaire (les routes d'écriture seraient ouvertes), lire le journal du conteneur avant de chercher ailleurs
TRAP-023 la création d'un compte ANNULE le compte si l'e-mail d'invitation ne part pas (route accounts) → sans BREVO_API_KEY, toute vérification locale de la création échoue ; pointer BREVO_API_URL sur un faux serveur local
TRAP-024 les types de `frontend-admin/src/app/(app)/*/types.ts` sont écrits À LA MAIN : rendre une colonne nullable côté Prisma ne produit AUCUNE erreur TypeScript, le plantage n'arrive qu'à l'affichage → après un changement de nullabilité, chercher les déréférencements à la main (`grep -rn "author\."`)
TRAP-025 `npx prisma format` réaligne des modèles sans rapport avec la modification → relire `git diff` et remettre ce qui n'était pas demandé (a touché WorkSchedule)
TRAP-026 `<form action={…}>` n'accepte qu'une ACTION SERVEUR (éventuellement liée par .bind), jamais une closure écrite dans un Server Component → TypeScript ne voit rien, l'erreur n'arrive qu'à l'exécution (« Functions cannot be passed directly to Client Components ») ; faire porter l'argument variable EN DERNIER pour pouvoir lier le reste depuis l'écran
TRAP-027 une action serveur limite son corps à 1 Mo PAR DÉFAUT → toute pièce jointe un peu grande échouait en « Body exceeded 1 MB limit » ; `experimental.serverActions.bodySizeLimit` dans frontend-admin/next.config.ts
TRAP-028 Next REFUSE une action serveur sans en-tête `Origin` (protection CSRF) → un test qui rejoue un formulaire à la main reçoit 500 tant qu'il ne l'envoie pas
TRAP-029 supprimer un ticket ou une tâche efface ses pièces jointes EN CASCADE côté base, sans passer par la route de retrait → relever les fileId AVANT la suppression et reprendre les fichiers après, sinon le volume se remplit d'orphelins

## STATE
branch=main
done=CC-301 à CC-339 traités et déployés SAUF CC-302 ; les livrés sont en EN_REVUE, pas en TERMINE (voir statut_ticket dans CONV)
done=temps mesuré (CC-330) en production ; import Asana fait (6 projets + Top formation)
done=vérifications : work-time 18/18, hr-calendar 18/18, sessions 31/31, partage du temps 9/9, accès 17/17 puis 10/10 après DEC-014, filtres+absences 15/15, masse+import 24/24, filtre assigné 7/7, écran Tickets dans Chrome 15/15
done=[18/09] écran Tickets : bandeau de sélection conditionnel, case « tout sélectionner », projets sur une ligne scrollable, groupes de filtres insécables, filtre « assigné à »
done=[21/09] CC-340, CC-341, CC-342, CC-344 livrés ; CC-343 : les 24 actions de modification/suppression orphelines ont toutes un écran, plus aucune action d'écriture n'est orpheline
done=[18/09] site vitrine : header, footer et socle CSS mutualisés dans site-chrome.js et site.css ; Partner Program recréé depuis la référence, candidature reliée à /api/contact, lien ajouté au header
done=[21/09] projets cloisonnés pour les DEV (DEC-023/024), phase modifiable depuis l'en-tête (DEC-026), plage d'heures supplémentaires retirée de Paramètres (DEC-025, migration retrait_plage_heures_supp), encadré RH renommé « Heures supplémentaires et récupération »
done=[21/09] vérifications : work-time 18/18 après retrait de la plage supplémentaire, hr-calendar 18/18, accès+phase 20/20 (HTTP), horaires+tableau de bord 8/8 (HTTP), écrans dans Chrome 13/13 chefferie + 9/9 développeur
done=[21/09] horaires écrits en prod : Sylvie 9-12/13-17, Luc et Gabrielle 9-12/13h30-17h30 ; Denis l'était déjà, Jayan reste sur le défaut de l'agence
done=[22/09] service codialis.files : lecture publique 3003, écriture privée 3004, volume codialis_files, commande `upload`, 23/23 en HTTP (jeton, traversée de chemin, signature binaire, taille, suppression)
done=[23/09] onglet Comptes (/equipe) ouvert au PM avec les mêmes droits que DIR (DEC-031) ; 19/19 API + 8/8 écran
done=[23/09] suppression d'un compte débloquée (DEC-032/033, migration auteur_facultatif_sur_suppression_de_compte) ; authorName/authorInitials dans format.ts ; message P2003 corrigé ; 24/24 bout en bout + calculs 18/18, 18/18, 18/18
done=[25/09] pièces jointes de bout en bout : relais backend (lib/files.ts + /api/admin/attachments), colonne fileId (migration piece_jointe_fichier_maison), bloc partagé sur fiche ticket et fiche tâche ; 26/26 HTTP + 8/8 par les actions serveur + calculs 18/18, 18/18, 18/18
wip=aucun
next=attendre le retour de Jayan et Gabrielle sur les tickets en EN_REVUE ; ils décident du passage à TERMINE
blocked=CC-302 pièces jointes — débloqué par DEC-027 (codialis.files) ; le socle Drive reste committé et inutilisé, on le retire quand le service maison aura fait ses preuves
blocked=DEC-009 — confirmer que le calendrier RH peut rester visible par toute l'équipe
blocked=DEC-014 annule CC-338 (livré le matin même) — prévenir Jayan et Gabrielle, le ticket est resté EN_REVUE avec un commentaire expliquant la volte-face
manual=secrets exposés dans les exports Asana importés (Stripe live, OVH, root VPS, Cloudflare R2, Brevo, PayPal, Orange) → à faire tourner
manual=une tâche importée (lot « DEV », « Faire une page en attendant le dev du site et la déployer ») contient encore des identifiants FTP et base OVH dans sa description → à nettoyer, proposé, sans réponse
manual=frontend-public : déploiement par git pull sur Hostinger ; contrôler le rendu du header/footer et de Partner Program après publication
manual=le sitemap EN LIGNE ne contient que 3 URLs contre 12 dans le dépôt — il n'a jamais été redéployé
manual=le portail client n'a plus de liste de bugs signalés (DEC-017) — à revoir si un compte client est créé
manual=l'écran Temps (/time, ouvert aux DEV) liste TOUS les projets non clôturés et le temps de toute l'équipe — hors portée de DEC-024, à trancher si le cloisonnement doit y descendre
manual=DEC-023 annule le cloisonnement ouvert par DEC-014 — prévenir Jayan et Gabrielle, et CC-338 redevient d'actualité sur une autre base (assignation, pas affectation)
manual=la suppression d'un compte désassigne ses tâches et ses tickets SANS prévenir — Sylvie porte 67 tâches et 15 tickets créés, à vérifier avant de la supprimer
manual=AVANT le premier déploiement : créer files/.env sur le serveur avec FILES_TOKEN, et la MÊME valeur dans backend/.env, sinon `docker compose up` échoue (TRAP-021) et les envois répondent « stockage non configuré »
manual=les fichiers servis par codialis.files sont PUBLICS pour qui a l'URL (non devinable, 32 hexadécimaux) — à confronter au cloisonnement des projets (DEC-023/024) avant d'y mettre des pièces jointes de tickets
manual=backend/src/lib/drive.ts et prisma/drive-consent.ts sont du code MORT, importés nulle part — à supprimer une fois codialis.files éprouvé (DEC-027)
manual=le README n'a pas de partie « Fonctionnalités » au format BxFy ; la référence fonctionnelle reste la liste de tickets en production
