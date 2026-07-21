# Codialis — Site & Admin

Site vitrine Codialis (pages statiques) + backend Express/MySQL pour l'admin (auth JWT, RH, contenu du site).

## Stack

- **Frontend** : pages HTML statiques (`.dc.html`), servies par Express avec URLs propres.
- **Backend** : Node.js (ESM) + Express 4, JWT (`jsonwebtoken`) + `bcrypt`, cookies HTTPOnly.
- **Base de données** : MySQL 8 (`mysql2`).
- **Dev/Prod** : Docker Compose (MySQL + serveur avec reload live).

## Structure

```
.
├── docker-compose.yml       # MySQL + serveur
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example         # copier en .env
│   ├── db/schema.sql        # schéma MySQL
│   └── src/
│       ├── index.js         # entrée Express, routage pages + API
│       ├── db.js            # pool mysql2 + shim compat Postgres->MySQL
│       ├── initdb.js        # applique schema.sql
│       ├── seed-admin.js    # crée le premier patron
│       ├── middleware/auth.js
│       └── routes/          # auth, accounts, entries, presence, content
└── frontend/
    ├── www/                 # index.html + pages *.dc.html + scripts
    ├── ../assets/              # servi sous /../assets
    └── public/              # servi sous /public
```

## Modèle de données

| Table      | Rôle                                                              |
|------------|-------------------------------------------------------------------|
| `users`    | Comptes — rôle `patron` ou `employe`, mot de passe hashé bcrypt.  |
| `entries`  | Heures sup / récup — `attente`/`valide`/`refuse`.                  |
| `presence` | Présence journalière — `present`/`tt`/`conge`.                    |
| `content`  | Contenu du site (portfolio/blog/testimonials/team), `data` JSON.  |

## Pages

| URL            | Fichier             |
|----------------|---------------------|
| `/`            | `index.html`        |
| `/portfolio`   | `Portfolio.dc.html` |
| `/blog`        | `Blog.dc.html`      |
| `/contact`     | `Contact.dc.html`   |
| `/financement` | `Financement.dc.html` |
| `/legal`       | `Legal.dc.html`     |
| `/admin`       | `Admin.dc.html`     |

Les chemins bruts `*.dc.html` restent servis (liens relatifs préservés).

## API

Toutes préfixées `/api` :

- `GET  /api/health` — sonde.
- `/api/auth` — connexion, session (JWT en cookie).
- `/api/accounts` — gestion des comptes.
- `/api/entries` — heures sup / récup.
- `/api/presence` — présence.
- `/api/content` — contenu du site.

> 🚀 **Déploiement production (Hostinger, sans Docker)** : voir [`README.prod.md`](./README.prod.md).

## Démarrage (Docker)

### 1. Config (une seule fois)

```bash
cp backend/.env.example backend/.env   # puis éditer JWT_SECRET (≥32 car.), ADMIN_EMAIL, ADMIN_PASSWORD
```

### 2. Lancer

```bash
docker compose up --build      # ajouter -d pour tourner en arrière-plan
```

- MySQL exposé sur `3307`, serveur sur `3001` → https://landingback.codialis.com
- Le **schéma s'applique tout seul** au démarrage (voir `db.js`) — pas de `db:init` à lancer.

### 3. Créer le premier admin (obligatoire au 1er lancement)

Une base neuve est **vide** : sans cette commande, aucun compte n'existe et le login échoue.

```bash
docker compose exec server npm run db:seed-admin
```

Crée le patron avec `ADMIN_EMAIL` / `ADMIN_PASSWORD` du `.env`. Se connecter sur https://landingback.codialis.com/admin.
Relancer la commande **réinitialise le mot de passe** de l'admin sur `ADMIN_PASSWORD` (pratique si tu l'as perdu).

### Commandes utiles

```bash
docker compose logs -f server                    # suivre les logs
docker compose restart server                    # redémarrer le serveur
docker compose down                              # arrêter (garde les données)
docker compose down -v && docker compose up -d   # RESET total (efface la base)
docker compose exec server npm run db:seed-admin # -> re-seed après un reset
```

> ⚠️ Après `down -v` la base est repartie de zéro : **relancer `db:seed-admin`**, sinon plus de compte pour se connecter.

## Démarrage (local, sans Docker)

MySQL requis. Mettre `DATABASE_URL` sur `localhost:3307` dans `.env` (au lieu de `db:3306`).

```bash
cd backend
npm install
cp .env.example .env        # éditer DATABASE_URL, JWT_SECRET, ADMIN_*
npm run db:seed-admin       # crée l'admin (schéma auto-appliqué)
npm run dev                 # nodemon
```

## Configuration (`backend/.env`)

| Variable         | Description                                          |
|------------------|------------------------------------------------------|
| `PORT`           | Port du serveur (défaut `3001`).                     |
| `DATABASE_URL`   | Connexion MySQL.                                     |
| `JWT_SECRET`     | Secret de signature JWT (long, aléatoire).           |
| `JWT_EXPIRES`    | Durée du token (ex. `12h`).                          |
| `ADMIN_*`        | Premier patron, utilisé par `db:seed-admin`.         |
| `NODE_ENV`       | `production` derrière HTTPS → cookie `Secure`.       |
| `BREVO_API_KEY`  | Clé API Brevo (envoi des identifiants employé).      |
| `BREVO_SENDER_*` | Nom + email expéditeur (email **validé** dans Brevo).|
| `APP_LOGIN_URL`  | Lien de connexion inclus dans l'email d'accueil.     |

`.env` jamais commité.
