# Codialis — site vitrine, back-office et API

Trois applications, un seul dépôt. La base de données n'est accessible que
depuis une seule d'entre elles.

```
navigateur ──▶ frontend-public  ──HTTP──▶  backend ──▶ MySQL
                (statique)                  (API)
navigateur ──▶ frontend-admin   ──HTTP──▶  backend ──▶ MySQL
                (Next.js)                   (API)
```

| Dossier | Rôle | Techno | Port (local) |
|---|---|---|---|
| [`frontend-public/`](frontend-public/) | Site vitrine : accueil, blog, portfolio, contact, pages de services. Entièrement public — aucune page privée | HTML statique + JS, servi par Apache | 3001 |
| [`frontend-admin/`](frontend-admin/) | Back-office : 28 écrans (CRM, projets, tickets, RH, pilotage, gestion du site vitrine) + portail client | Next.js 16, App Router | 3002 |
| [`backend/`](backend/) | **Toute** la donnée : routes publiques du site + API admin | Next.js 16 en route handlers, Prisma, MySQL | 3001 (interne) |

`backend.backup/` conserve en lecture l'ancien serveur Express, remplacé.

## Démarrage

```bash
docker compose -f compose.local.yml up -d --build
```

- http://localhost:3001 — site vitrine (Apache relaie `/api` vers l'API, ce qui
  garde le site en une seule origine)
- http://localhost:3002 — back-office

Le schéma est appliqué au démarrage du backend. Pour les comptes et données de
démonstration :

```bash
docker compose -f compose.local.yml exec backend npx tsx prisma/seed.ts
```

Comptes de démonstration (mot de passe `codialis2026`) : `claire@codialis.fr`
(direction), `marion@codialis.fr` (cheffe de projet), `lea@codialis.fr`
(développeuse), `sophie@topformation.fr` (portail client).

Sans Docker, chaque application se lance indépendamment — voir
[`backend/README.md`](backend/README.md) et
[`frontend-admin/README.md`](frontend-admin/README.md).

> Le site vitrine **doit** rester sur le port 3001 en local : son JavaScript
> teste `location.port === '3001'` pour décider d'appeler `/api` en relatif
> plutôt que le domaine de production.

## Comment les trois applications communiquent

**Site vitrine → API.** Le site est statique et hébergé séparément (Hostinger) :
chaque appel est cross-origin. Les routes concernées sont publiques en lecture
et n'utilisent aucun cookie ; seules les origines listées dans `CORS_ORIGINS`
reçoivent l'en-tête d'autorisation.

**Back-office → API.** Le navigateur ne s'adresse qu'à `frontend-admin`. C'est
son serveur Next qui appelle l'API, en relayant la session dans un en-tête
`Authorization: Bearer`. Aucun cookie ne traverse une frontière d'origine, et
l'URL de l'API n'est jamais exposée au navigateur. Le backend signe le JWT à la
connexion et le renvoie dans le corps de la réponse ; `frontend-admin` le range
en cookie httpOnly sur son propre domaine.

**Les droits sont appliqués par l'API.** Les gardes de `frontend-admin` évitent
d'afficher un écran interdit ; elles ne protègent pas les données. Chaque route
revérifie le rôle, et deux cloisonnements vont plus loin : un développeur ne
voit que les projets sur lesquels il est affecté, un client ne voit que le
projet déduit de sa session.

## Production

`docker-compose.yml` monte la pile derrière Traefik :

| Hôte | Service |
|---|---|
| `landingback.codialis.com` | API (`backend`) |
| `admin.codialis.com` | back-office (`frontend-admin`) |

Le site vitrine est déployé à part, en fichiers statiques. Les secrets
(`DATABASE_URL`, `AUTH_SECRET`, `CORS_ORIGINS`, `GOOGLE_API_KEY`) viennent de
`backend/.env`, hors du dépôt.

`README.prod.md` décrit un déploiement Hostinger **de l'ancienne architecture
Express** (un seul process Node servant l'API et les pages). Il n'est pas à jour
pour la découpe actuelle.
