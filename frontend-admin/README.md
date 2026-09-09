# frontend-admin — back-office Codialis

Les 32 écrans du back-office : Dashboard, À traiter, Projets (liste / kanban /
fiche / détail de tâche), Prospection, Remontées client, Messagerie, Ressources,
Tickets, Temps, RH, Pilotage, Rentabilité, Maintenance, Automatisations, la
gestion du site vitrine (contenu, réglages, retours, veille), les comptes,
le mot de passe, et le portail client
(Avancement, Signalements, Mon projet, Rendez-vous, Échanges).

Next.js 16 (App Router, TypeScript, Tailwind 4). **Aucun accès direct à la base
de données** : cette application ne connaît que l'API HTTP de `../backend`.

## Démarrage

```bash
npm install
cp .env.example .env    # puis renseigner BACKEND_URL
npm run dev
```

L'API doit tourner en parallèle (voir `../backend/README.md`), ou lancer la pile
complète depuis la racine : `docker compose -f compose.local.yml up -d --build`.

## Comment elle parle au backend

Le navigateur ne s'adresse **qu'**à frontend-admin. C'est le serveur Next qui
appelle l'API, en relayant la session dans un en-tête `Authorization: Bearer`
(`src/lib/api.ts`).

```
navigateur ──cookie httpOnly──▶ frontend-admin ──Bearer <JWT>──▶ backend ──▶ MySQL
```

Ce choix évite les cookies inter-origines, et donc tout `SameSite=None`, tout
CORS avec credentials et tout `Secure` obligatoire en développement. Il garde
aussi `BACKEND_URL` privé : la variable n'est pas préfixée `NEXT_PUBLIC_`, l'URL
de l'API n'atteint jamais le navigateur.

### Session

Le backend signe le JWT à la connexion et le renvoie **dans le corps** de la
réponse ; frontend-admin le range dans un cookie httpOnly sur son propre
domaine (`src/lib/auth.ts`). Il ne connaît pas `AUTH_SECRET` et ne vérifie donc
jamais un jeton lui-même : la validité est établie par le backend à chaque
appel. Un jeton expiré ou forgé passe la garde du proxy, se fait refuser en 401,
et `apiGet` renvoie l'utilisateur au login.

`src/proxy.ts` ne teste que la **présence** du cookie. Le faire côté page
plutôt que dans le proxy pour la redirection inverse (session valide sur
`/login`) est délibéré : avec un cookie périmé, rediriger sur la seule présence
du cookie provoquait une boucle — la page rebondissait vers l'app, qui
rebondissait au login.

### Droits

`requireRole()` (`src/lib/auth.ts`) empêche d'**afficher** un écran interdit,
mais ne fait pas autorité : chaque route du backend revérifie le rôle de son
côté, et c'est elle qui protège réellement les données. Un 403 renvoie
l'utilisateur sur la page par défaut de son rôle.

## Formes des données

`src/lib/dto.ts` et les `types.ts` par écran déclarent à la main les formes
renvoyées par l'API ; `src/lib/types.ts` reprend les énumérations du domaine.
C'est le contrat entre les deux applications — il est écrit plutôt que dérivé de
Prisma, parce que cette application n'a pas accès au client généré. Le typecheck
échoue si le backend cesse de l'honorer.

**Une modification d'`enum` dans `backend/prisma/schema.prisma` doit être
répercutée dans `src/lib/types.ts`.** C'est le prix de la séparation : le seul
lien entre les deux applications est le JSON de l'API, pas un paquet partagé.

### Dates

Prisma renvoyait des `Date` ; le JSON les transporte en chaînes ISO. Le reviver
de `src/lib/api.ts` les reconstruit à la lecture, sur un motif strict (date +
heure + fuseau), pour que tout le code d'affichage (`fmtDate`, `.getTime()`,
comparaisons) continue de fonctionner à l'identique.

## Mutations

Les Server Actions sont conservées : les formulaires n'ont pas changé. Leur
corps ne fait plus que traduire — lire le `FormData`, appeler `apiPost`,
`revalidatePath`. Toute la logique métier (barèmes d'étapes, enchaînement des
statuts, recalcul de l'avancement, attribution des références) vit dans le
backend.

Deux endroits où l'écran reste maître du calendrier, et non le backend :

- **`/rh`** — les bornes du mois et les 5 jours de la semaine partent de l'écran
  en paramètres de requête. La grille du planning retrouve chaque créneau par
  égalité **exacte** de date ; si le backend recalculait « cette semaine » de son
  côté, le moindre décalage ferait disparaître un créneau de sa propre case.
- **`/pilotage`** — mêmes bornes de mois, pour que le libellé de période affiché
  et les chiffres renvoyés décrivent la même période.

## Écrans à chargement partiel

Trois écrans ne chargent que ce qu'ils montrent, l'onglet actif étant résolu
côté API : `/resources` (une seule famille de ressources), `/portal/project`
(devis / fonctionnalités / cahier des charges), et l'onglet « Fiche » de
`/projects/[id]` (accès techniques et questions client, non chargés sur les vues
Liste et Kanban).

## Comptes de démonstration

Mot de passe commun : `codialis2026`. Les comptes sont créés par
`../backend/prisma/seed.ts` — voir `../backend/README.md`.

## Gestion du site vitrine (`/site*`)

Trois écrans pilotent ce que publie `../frontend-public`, réservés à la
direction et à la chefferie de projet :

| Écran | Ce qu'il fait |
|---|---|
| `/site` | Articles de blog, projets du portfolio, témoignages : liste, publication, modification, suppression |
| `/site/reglages` | En-têtes des pages Blog et Portfolio, réseaux sociaux, logos clients |
| `/site/messages` | Demandes du formulaire de contact, abonnés à la newsletter, compteurs de visites |

Le contrat de forme est strict : le site vitrine est figé, et chaque champ
saisi ici correspond à un champ qu'il lit réellement. Les formulaires composent
l'objet attendu, et `backend/src/lib/site-schemas.ts` le refuse s'il ne
correspond pas — une catégorie de blog inconnue ou un projet sans secteur
échoue à l'enregistrement plutôt que de casser la page publique.

`image-field.tsx` est le seul composant client de ces écrans : convertir un
fichier déposé en data URL demande un `FileReader`, donc le navigateur. La
valeur part ensuite dans un input caché, comme n'importe quel champ — le reste
du formulaire est entièrement serveur.

Deux comportements à connaître avant de s'inquiéter d'un bug :

- **Un contenu « à la une » décroche le précédent.** Le site n'en affiche qu'un
  par type.
- **Une écriture met jusqu'à 60 secondes à apparaître** chez un visiteur qui a
  déjà chargé la page : les routes publiques sont cacheables
  (`max-age=60, stale-while-revalidate=300`), politique héritée et voulue.

## Parcours par e-mail

Trois pages sont accessibles **sans session** — `src/proxy.ts` les laisse
passer explicitement, sans quoi les liens reçus par e-mail seraient
inutilisables :

| Page | Rôle |
|---|---|
| `/login` | connexion, avec le lien « mot de passe oublié » |
| `/reset` | demande de lien, puis choix du nouveau mot de passe (`?token=`) |
| `/verify` | confirmation d'un compte fraîchement créé (`?token=`) |

Le mot de passe d'un nouveau compte n'apparaît jamais à l'écran : il est
engendré et envoyé par le backend après confirmation de l'adresse. Voir
`../backend/README.md` pour les garde-fous.
