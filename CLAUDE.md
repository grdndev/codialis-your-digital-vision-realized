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
env=prod → landingback.codialis.com(API) admin.codialis.com(back-office) codialis.com(vitrine, Hostinger)
prod_ssh=ubuntu@135.125.254.251:~/codialis
prod_services=codialis.db(codialis-db) codialis.backend(codialis-api) codialis.admin(codialis-admin)

## CMD
typecheck=npx tsc --noEmit  scope=backend et frontend-admin séparément
lint=./node_modules/.bin/eslint src  why=`npx eslint` échoue hors du dossier de l'app
build=npx next build
test_calcul=npx tsx prisma/test-work-time.ts | npx tsx prisma/test-work-calendar.ts | npx tsx prisma/test-hr-calendar.ts
seed_test=DATABASE_URL=… npx tsx prisma/seed-test.ts  DANGER=local uniquement, vide la base avant de semer
migrate_local=DATABASE_URL=… npx prisma migrate dev --name … --skip-seed
migrate_prod=docker compose exec codialis.backend npx prisma migrate deploy
deploy=ssh prod → cd ~/codialis && git pull --ff-only && docker compose build codialis.backend codialis.admin && docker compose up -d codialis.backend codialis.admin
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
backend/prisma/schema.prisma=schéma unique
backend/prisma/seed-test.ts=jeu d'essai local
backend/prisma/import-asana.ts=import ponctuel des exports Asana
frontend-admin/src/app/(app)/=écrans internes, un dossier par écran, actions.ts + types.ts + page.tsx
frontend-admin/src/app/(client)/portal/=portail client
frontend-admin/src/lib/api.ts=apiGet/apiPost, relais du Bearer, réanimation des dates ISO
frontend-admin/src/lib/nav.ts=menu et rôles autorisés par écran
frontend-admin/src/proxy.ts=garde de session + mémoire d'écran (filtres, dernier projet)
frontend-public/=site vitrine statique, déployé à la main sur Hostinger
entry=backend/src/app/api/admin/*/route.ts et frontend-admin/src/app/(app)/*/page.tsx

## DEC
DEC-001 [2026-09-17] ACTIVE les droits sont appliqués par l'API, jamais par l'écran why=les gardes de frontend-admin n'évitent que d'afficher, elles ne protègent pas les données alt=confiance au frontend
DEC-002 [2026-09-17] ACTIVE un DEV accède à un projet s'il y est affecté OU y porte un ticket OU une tâche why=donner du travail sans affecter est courant, et refuser l'accès à ce sur quoi on travaille n'a pas de sens alt=affectation seule (état initial, à l'origine de CC-337)
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

## STATE
branch=main
done=CC-301 à CC-339 traités et déployés SAUF CC-302 ; les livrés sont en EN_REVUE, pas en TERMINE (voir statut_ticket dans CONV)
done=temps mesuré (CC-330) en production ; import Asana fait (6 projets + Top formation)
done=vérifications : work-time 18/18, hr-calendar 18/18, sessions 31/31, partage du temps 9/9, accès 17/17, filtres+absences 15/15, masse+import 24/24
wip=aucun
next=attendre le retour de Jayan et Gabrielle sur les tickets en EN_REVUE ; ils décident du passage à TERMINE
blocked=CC-302 pièces jointes — le socle Drive est committé, il manque le client ID et le secret OAuth d'un projet Google Cloud à créer par l'utilisateur
blocked=DEC-009 — confirmer que le calendrier RH peut rester visible par toute l'équipe
manual=balayage éditabilité : l'API accepte la modification des lots, tâches, critères de tâche, deals, saisies de temps, actions et des 7 types de ressources, mais AUCUN écran ne l'appelle encore
manual=secrets exposés dans les exports Asana importés (Stripe live, OVH, root VPS, Cloudflare R2, Brevo, PayPal, Orange) → à faire tourner
manual=une tâche importée (lot « DEV », « Faire une page en attendant le dev du site et la déployer ») contient encore des identifiants FTP et base OVH dans sa description → à nettoyer, proposé, sans réponse
manual=le README n'a pas de partie « Fonctionnalités » au format BxFy ; la référence fonctionnelle reste la liste de tickets en production
