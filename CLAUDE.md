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
test_calcul=npx tsx prisma/test-work-time.ts | npx tsx prisma/test-work-calendar.ts | npx tsx prisma/test-hr-calendar.ts | npx tsx prisma/test-billing.ts
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
textes_multilignes=parseMultiline (frontend-admin/src/lib/format.ts) à la lecture, `whitespace-pre-wrap` à l'affichage
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
backend/src/lib/billing.ts=échéancier de facturation d'un projet (pourcentages, échéance suivante, solde), calcul pur
backend/src/lib/goals.ts=objectifs : lecture cloisonnée (Dashboard + écran Objectifs) et seules règles d'écriture (DIR)
backend/src/lib/agency-rates.ts=taux horaire et durée d'une journée de l'agence, heures vendues d'un prix
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
frontend-admin/src/app/(app)/list-controls.tsx=filtres en pastilles et pagination 15/25/50 partagés (Tickets, fiche projet, Ressources)
frontend-admin/src/app/(app)/tickets/export/route.ts=export CSV/JSON des tickets (route de frontend-admin, relit GET /api/admin/tickets)
frontend-admin/src/lib/theme.ts=couleurs réglables du back-office (jetons = variables CSS de globals.css)
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
DEC-036 [2026-09-28] ACTIVE « En retard » se pose À LA MAIN sur une facture (action set-invoice-status, EN_ATTENTE ↔ EN_RETARD), jamais sur une facture payée why=CC-348 ; c'est qui relance le client qui sait si une échéance dépassée est un retard ou un délai convenu alt=passage automatique à l'échéance (non demandé)
DEC-038 [2026-09-30] ACTIVE les couleurs du back-office sont un réglage PERSONNEL (User.themeColors, seules les couleurs modifiées), 7 jetons ; les couleurs d'état (alerte, erreur, info) restent fixes why=CC-353, arbitrage Denis du 30/09 ; Paramètres est ouvert aux DEV, un thème commun laisserait chacun changer l'écran de tous alt=thème d'agence réglé par DIR/PM
DEC-039 [2026-09-30] ACTIVE filtres de Ressources = projet, recherche, personne (propriétaire d'une API), statut (maquettes, documents) ; « ticket » et « gravité » demandés par CC-353 sont ÉCARTÉS why=ces notions n'existent pas sur une ressource, arbitrage Denis du 30/09 — à signaler à Luc alt=attendre sa précision
DEC-040 [2026-09-30] ACTIVE objectifs du mois = objectifs LIBRES (intitulé, échéance, projet facultatif) posés par la direction SEULE, lus par toute l'équipe en tête du Dashboard ; un DEV ne voit pas l'avancement d'un projet qu'il ne peut pas ouvrir (DEC-024) why=CC-347, arbitrage Denis du 30/09 alt=objectif de CA de Pilotage recopié sur le Dashboard
DEC-041 [2026-09-30] ACTIVE échéancier de facturation : prix total = soldAmount (le « montant vendu » de la fiche), pourcentages dans Project.billingPlan (NULL = 30/40/30 ; proposés 30/40/30, 40/30/30, 50/50) ; l'API fixe libellé et montant de l'échéance suivante ; le SOLDE = total − déjà facturé sur l'échéancier ; facture libre = milestone NULL, hors échéancier ; une échéance = une seule facture (index unique projet+échéance) why=CC-350 alt=libellé et montant saisis à la main (état initial, conservé en « facture libre »)
DEC-042 [2026-09-30] ACTIVE rattacher une facture à une échéance est permis MÊME PAYÉE (set-invoice-milestone) why=reprendre les factures émises avant l'échéancier ; ni montant ni libellé ne bougent, la pièce comptable reste intacte alt=réservé aux factures non payées
DEC-043 [2026-09-30] ACTIVE garantie et maintenance = deux dates de fin sur le projet (dernier jour couvert, minuit UTC), cumulables et indépendantes de la phase ; posées par PM/DIR dans un bloc NON replié de l'onglet Fiche, lues par tous en en-tête why=CC-351 ; la phase WAR/MAI est exclusive et sans date alt=phase seule
DEC-044 [2026-09-30] ACTIVE import JSON : un seul choix d'assigné pour TOUS les tickets créés, « Personne » par défaut ; les tâches importées restent sans assigné why=CC-354 ne parle que des tickets alt=assigné par ticket dans le JSON
DEC-045 [2026-09-30] ACTIVE export des tickets en CSV (point-virgule, BOM UTF-8, heure de La Réunion, décimales à virgule) ou JSON (codes bruts, instants ISO, champs de l'import), par une route de frontend-admin qui relit GET /api/admin/tickets ; `assignee` y accepte une liste d'identifiants (+ `none`) why=CC-353 ; les droits restent ceux de la liste des tickets alt=route d'export dans le backend
DEC-046 [2026-09-30] ACTIVE « Qui est là » lit AUSSI le planning de la semaine (PlannedShift) : télétravail, absence et « chez le client » y font une pastille, « bureau » aucune ; priorité demande d'absence > planning du jour > règle récurrente ; la grille couvre des semaines entières (bornes posées par l'écran, `calendarStart`/`calendarEnd`) why=CC-355 ; le planning est ce que l'équipe remplit réellement (Absences et règles vides en prod), et la semaine en cours déborde sur le mois voisin alt=planning ignoré (état initial), grille bornée au mois
DEC-047 [2026-09-30] ACTIVE une facture se SUPPRIME même payée (PM et DIR), après confirmation qui prévient qu'elle sort de l'encaissé ; son MONTANT, lui, ne se modifie toujours plus une fois payée why=demande du 30/09 : F-2601 et F-2602 (Sumvibes, 1 €, reliquat de CC-324) étaient marquées payées et indélébiles, et le message renvoyait à un « avoir » que le CRM n'a pas alt=facture payée intouchable (état initial), remise en attente puis suppression
DEC-048 [2026-09-30] ACTIVE les fenêtres flottantes (Exporter, Importer du JSON, Nouvel épic, confirmation de suppression de facture) se ferment au clic extérieur, sur Échap et après l'envoi de leur formulaire : composant Popover (frontend-admin/src/app/(app)/popover.tsx) why=demande du 30/09 sur l'export ; même comportement pour les fenêtres de la même barre alt=`<details>` nu, qui ne se ferme qu'en recliquant son bouton
DEC-049 [2026-09-30] ACTIVE les images jointes s'ouvrent dans une visionneuse (`<dialog>` modal, ← → entre les images de la fiche, damier derrière les images transparentes, lien vers l'original) au lieu d'un nouvel onglet why=demande du 30/09 alt=lien vers files.codialis.com (état initial)
DEC-050 [2026-09-30] ACTIVE heures vendues = montant vendu ÷ taux horaire de l'agence, au dixième ; PM/DIR règlent le taux horaire ET la durée d'une journée dans « Rentabilité & temps », le taux journalier en découle (défaut 90 €/h × 8 h = 720 €) ; recalculées SEULEMENT quand le montant change, un projet déjà vendu garde ses heures ; sans montant, les heures restent saisies why=CC-357, arbitrage Denis du 30/09 alt=taux journalier seul (conversion en heures ambiguë), recalcul de tous les projets à chaque changement de taux
DEC-051 [2026-09-30] ACTIVE un objectif se CLÔT sur un constat : atteint (commentaire facultatif) ou non atteint (raison OBLIGATOIRE), daté (closedAt) ; écran Objectifs ouvert à toute l'équipe (en cours + historique par mois d'échéance + taux d'atteinte), piloté par la direction seule ; le Dashboard garde les en cours et les clos du mois why=CC-356, « savoir s'il a été atteint ou non et pourquoi pour avoir un suivi » alt=case « atteint » sans constat (CC-347)
DEC-052 [2026-09-30] ACTIVE exception à « une route POST par écran » : les objectifs ne s'ÉCRIVENT que par /api/admin/objectifs, y compris depuis le bloc du Dashboard ; la route du Dashboard ne fait que les lire why=une seule règle d'écriture (src/lib/goals.ts), pas deux copies qui divergent alt=mêmes actions dupliquées dans les deux routes
DEC-037 [2026-09-28] ACTIVE une facture a un HISTORIQUE de commentaires (InvoiceComment), ouvert même une fois payée, sans modification ni suppression ; l'auteur suit DEC-032 (NULL si le compte est supprimé), les commentaires suivent la facture en CASCADE why=CC-349 ; c'est souvent après le règlement qu'on note comment il s'est fait alt=champ de notes unique sur la facture (écrasé à chaque saisie)

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
TRAP-030 après une action de formulaire réussie, React vide le formulaire par un `reset` : les cases se décochent SANS évènement `change` → tout compteur tenu par `onChange` doit aussi écouter `onReset` (CC-352, bandeau de masse resté affiché)
TRAP-031 une `<textarea>` envoyée par formulaire arrive avec des retours à la ligne en `\r\n` (norme HTML) → passer par `parseMultiline` (lib/format.ts) avant d'écrire, sinon la base mélange `\r\n` et `\n` et un `split("\n")` garde des `\r`
TRAP-033 `prisma migrate dev` REFUSE de créer une migration qui lève un avertissement (index unique ajouté…) quand l'environnement n'est pas interactif → `rtk proxy npx prisma migrate diff --from-url <base locale> --to-schema-datamodel prisma/schema.prisma --script` dans un dossier de migration daté, puis `migrate deploy`
TRAP-034 le hook rtk réécrit la sortie de certaines commandes (`prisma migrate diff` affiché « No such file or directory », `next build` résumé en « 1 routes ») → `rtk proxy <commande>` pour la sortie brute
TRAP-035 test Playwright : `waitForLoadState("networkidle")` après un clic sur un `<Link>` rend la main AVANT la navigation côté client → attendre le changement d'adresse (`waitForURL(u => u.href !== avant)`)
TRAP-036 `Intl.NumberFormat("fr-FR")` sépare les milliers par U+202F et met U+00A0 avant « € » → normaliser les espaces avant de comparer un montant dans un test
TRAP-037 les factures d'avant l'échéancier ont milestone NULL → tant qu'elles ne sont pas rattachées, l'échéancier propose l'ACOMPTE à un projet déjà facturé (Top formation a un « Mi parcours ») ; rattacher depuis Facturation → facture → « Échéance »
TRAP-038 le mode auto de Claude Code REFUSE les écritures sur le serveur de prod (ssh + docker compose exec) : la lecture passe, le changement de statut d'un ticket et le déploiement exigent une permission explicite de Denis
TRAP-039 chaque déploiement invalide les actions serveur des pages déjà ouvertes : un clic depuis une page chargée avant le rebuild ne fait RIEN à l'écran (« Failed to find Server Action » dans le journal de codialis-admin) → recharger la page ; regrouper les déploiements plutôt que d'en enchaîner plusieurs dans la journée
TRAP-040 les horaires de travail sont des heures de BUREAU À LA RÉUNION, les sessions des instants UTC → le calcul (work-time.ts) décale les instants de +4 h avant de les rogner ; il les lisait en UTC jusqu'au 30/09 (9h-12h comptait 13h-16h locales, le matin valait 0 h) sans qu'aucun test ne le voie, les tests écrivant leurs heures en UTC comme si c'était l'heure locale
TRAP-041 un statut de ticket ou de tâche écrit HORS de applyTicketStatus / des routes (script, updateMany) laisse tourner le chronomètre : close-client-reports.ts a passé AD-301 et AD-307 à TERMINE le 18/09 sans fermer leurs sessions, qui ont compté 56 h à Denis jusqu'au 30/09 → tout script qui change un statut doit appeler closeSessions/openSession (lib/work-sessions.ts) ; contrôle : `workSession` sans `endedAt` dont le ticket ou la tâche n'est pas EN_COURS
TRAP-032 le conteneur codialis-api NE migre PAS au démarrage (`CMD next start`) → entre `docker compose up -d --build` et `migrate deploy`, tout écran qui lit une nouvelle table plante ; lancer la migration immédiatement après le rebuild (Facturation cassée quelques minutes le 28/09)

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
done=[28/09] CC-352 : le bandeau de modification de masse disparaît après « Appliquer » ; 9/9 dans Chrome
done=[28/09] CC-345 : commentaires multilignes sur fiche ticket et fiche tâche ; descriptions et commentaires gardent leurs sauts de ligne à l'affichage ; 14/14 dans Chrome
done=[28/09] CC-348 : marquer une facture en retard / la remettre en attente (DEC-036) ; 11/11 HTTP + 9/9 dans Chrome
done=[28/09] CC-349 : historique de commentaires sur chaque facture (DEC-037, migration commentaires_facture) ; 25/25 HTTP (dont CC-348) + 16/16 dans Chrome + calculs 18/18, 18/18, 18/18
done=[28/09] CC-345, CC-348, CC-349, CC-352 déployés (5400e83), migration commentaires_facture appliquée en prod ; CC-302, CC-345, CC-348, CC-349, CC-352 passés en EN_REVUE
done=[30/09] CC-346, CC-347, CC-350, CC-351, CC-353 (8 points), CC-354 codés et vérifiés en local : CC-353 46/46 dans Chrome, CC-354 11/11, CC-351 17/17, CC-350 30/30, CC-347 22/22 (HTTP + Chrome) ; calculs 18/18, 26/26, 18/18, billing 27/27 ; types, lint et build des deux applications OK
done=[30/09] 5 migrations : couleurs_personnelles, couverture_garantie_maintenance, echeancier_facturation, echeance_unique_par_projet, objectifs_du_mois
done=[30/09] déployé (11a56cd), les 5 migrations appliquées en prod juste après le rebuild ; CC-346, CC-347, CC-350, CC-351, CC-353, CC-354 passés en EN_REVUE (directement : le passage EN_COURS avait été bloqué par TRAP-038)
wip=aucun
done=[30/09] CC-355 : pastilles du planning de la semaine dans « Qui est là », grille en semaines entières ; hr-calendar 27/27, 11/11 dans Chrome
done=[30/09] hors tickets : suppression des factures payées (DEC-047), fenêtres flottantes qui se ferment (DEC-048), visionneuse d'images (DEC-049) ; 18/18 et 16/16 dans Chrome
done=[30/09] CC-357 : taux de l'agence et heures vendues calculées (DEC-050, migration taux_agence) ; 18/18 HTTP + Chrome, billing 32/32
done=[30/09] temps mesuré : horaires lus en heure de La Réunion (TRAP-040), work-time 23/23 dont 5 cas en instants réels
done=[30/09] temps mesuré recalculé en prod (accord de Denis) : 32 sessions, 132,97 h → 135,34 h ; dernière activité des projets remise à sa date ; sauvegarde ~/backups/temps-mesure/avant-20260930-074948.json sur le serveur
done=[30/09] le recalcul a aligné ADD de 31 h (compteur périmé) à 95 h, dont 56 h de deux chronomètres orphelins (TRAP-041) ; ceux-ci fermés à l'heure de leur clôture (18/09 06:03:40 UTC) : ADD = 43,26 h, AD-307 2,9 h, AD-301 0,66 h
done=[30/09] CC-356 : écran Objectifs, constat atteint/non atteint avec raison (DEC-051/052, migration objectifs_constat) ; 18/18 HTTP + Chrome
wip=aucun
next=attendre le retour de Gabrielle et Jayan sur les tickets en EN_REVUE
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
manual=après déploiement : rattacher les factures existantes à leur échéance (TRAP-037) et saisir le prix total + l'échéancier des projets ouverts dans Facturation → « Échéancier des projets » — soldAmount était NULL sur tous les projets facturés au relevé du 30/09
manual=un chronomètre laissé « En cours » compte chaque journée de bureau jusqu'à ce qu'on change le statut (Luc sur AD-311 depuis le 28/09) : à surveiller, ou à arrêter d'office en fin de journée si l'équipe le souhaite
manual=des tâches importées portent des heures passées sans session ni saisie (ADD : 24 h) : la première session ouverte sur l'une d'elles recalculera son compteur à partir des seules sessions et saisies, et effacera ces heures importées (DEC-004)
manual=update-project (formulaire « Modifier le projet ») REDATE la clôture à chaque enregistrement d'un projet clôturé (`closedAt: new Date()`), contrairement à update-project-phase qui la garde — bug existant, non corrigé, à proposer
manual=signaler à Luc que « ticket » et « gravité » ne sont pas des filtres de Ressources (DEC-039), et lui demander s'il visait un autre écran
manual=CC-346 et le point 2 de CC-353 sont le même besoin, livrés ensemble
manual=le README n'a pas de partie « Fonctionnalités » au format BxFy ; la référence fonctionnelle reste la liste de tickets en production
