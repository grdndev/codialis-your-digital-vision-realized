# Codialis — Site & Admin

Site vitrine Codialis (pages statiques) + backend Express/Postgres pour l'admin (auth JWT, RH, contenu du site).

## Stack

- **Frontend** : pages HTML statiques (`.dc.html`), servies par Express avec URLs propres.
- **Backend** : Node.js (ESM) + Express 4, JWT (`jsonwebtoken`) + `bcrypt`, cookies HTTPOnly.
- **Base de données** : PostgreSQL 16 (`pg`).
- **Dev/Prod** : Docker Compose (Postgres + serveur avec reload live).

## Structure

```
.
├── docker-compose.yml       # Postgres + serveur
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example         # copier en .env
│   ├── db/schema.sql        # schéma Postgres
│   └── src/
│       ├── index.js         # entrée Express, routage pages + API
│       ├── db.js            # pool pg
│       ├── initdb.js        # applique schema.sql
│       ├── seed-admin.js    # crée le premier patron
│       ├── middleware/auth.js
│       └── routes/          # auth, accounts, entries, presence, content
└── frontend/
    ├── www/                 # index.html + pages *.dc.html + scripts
    ├── assets/              # servi sous /assets
    └── public/              # servi sous /public
```

## Modèle de données

| Table      | Rôle                                                              |
|------------|-------------------------------------------------------------------|
| `users`    | Comptes — rôle `patron` ou `employe`, mot de passe hashé bcrypt.  |
| `entries`  | Heures sup / récup — `attente`/`valide`/`refuse`.                  |
| `presence` | Présence journalière — `present`/`tt`/`conge`.                    |
| `content`  | Contenu du site (portfolio/blog/testimonials/team), `data` JSONB. |

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

## Démarrage (Docker)

```bash
cp backend/.env.example backend/.env   # puis éditer JWT_SECRET, ADMIN_*
docker compose up --build
```

Postgres exposé sur `5433`, serveur sur `3001` → http://localhost:3001

Init DB + premier admin (une fois, DB lancée) :

```bash
docker compose exec server npm run db:init
docker compose exec server npm run db:seed-admin
```

## Démarrage (local, sans Docker)

Postgres requis (voir `DATABASE_URL` dans `.env`).

```bash
cd backend
npm install
cp .env.example .env        # éditer
npm run db:init
npm run db:seed-admin
npm run dev                 # nodemon
```

## Configuration (`backend/.env`)

| Variable         | Description                                          |
|------------------|------------------------------------------------------|
| `PORT`           | Port du serveur (défaut `3001`).                     |
| `DATABASE_URL`   | Connexion Postgres.                                  |
| `JWT_SECRET`     | Secret de signature JWT (long, aléatoire).           |
| `JWT_EXPIRES`    | Durée du token (ex. `12h`).                          |
| `ADMIN_*`        | Premier patron, utilisé par `db:seed-admin`.         |
| `NODE_ENV`       | `production` derrière HTTPS → cookie `Secure`.       |
| `BREVO_API_KEY`  | Clé API Brevo (envoi des identifiants employé).      |
| `BREVO_SENDER_*` | Nom + email expéditeur (email **validé** dans Brevo).|
| `APP_LOGIN_URL`  | Lien de connexion inclus dans l'email d'accueil.     |

`.env` jamais commité.
