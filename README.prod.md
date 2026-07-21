# Déploiement production — Hostinger (hébergement Node.js + MySQL managé)

Guide pour héberger Codialis sur un **hébergement classique Hostinger** (hPanel,
sans Docker, sans accès root). L'app Node tourne sous **Passenger**, la base est
un **MySQL managé** créé dans hPanel.

> Un seul process Node sert **tout** : l'API `/api/*` **et** les pages du site
> (`/`, `/blog`, `/admin`, …). Pas de serveur web séparé pour le frontend.

---

## Vue d'ensemble

| Élément            | Valeur                                                             |
|--------------------|-------------------------------------------------------------------|
| Runtime            | Node.js 20 LTS (min. 18 — requis pour `crypto.randomUUID`)         |
| Point d'entrée     | `backend/src/index.js` (ESM, `"type":"module"`)                   |
| Dossier de l'app   | `backend/` (contient `package.json`)                              |
| Frontend           | `frontend/` — **doit rester à côté de `backend/`** (chemin `../../frontend`) |
| Base de données    | MySQL 8 managé Hostinger                                          |
| Port               | fourni par Passenger via `process.env.PORT` (ne pas forcer)       |
| HTTPS              | SSL + reverse proxy Hostinger → `NODE_ENV=production`             |

**Structure à conserver sur le serveur** (les deux dossiers côte à côte) :

```
<racine du site>/
├── backend/          <- Application root Node.js (package.json ici)
│   ├── src/index.js  <- fichier de démarrage
│   ├── db/schema.sql
│   └── .env          <- secrets (ou variables via hPanel)
└── frontend/         <- servi par le backend (www, assets, public)
```

---

## 1. Créer la base MySQL (hPanel)

1. hPanel → **Bases de données → MySQL**.
2. Créer une base + un utilisateur. Hostinger préfixe les noms, ex :
   - base : `u123456789_codialis`
   - user : `u123456789_admin`
   - mot de passe : (le noter)
3. Donner **tous les droits** de l'utilisateur sur la base.
4. Noter le **hôte** : en général `localhost` (base sur le même serveur que l'app).
   Pour du MySQL distant, utiliser l'hôte fourni + autoriser l'IP dans hPanel.

Le **schéma se crée tout seul** au premier démarrage de l'app (voir `backend/src/db.js`,
`CREATE TABLE IF NOT EXISTS`). Rien à importer à la main.

---

## 2. Envoyer le code

**Option A — Git (recommandé)** : hPanel → **Avancé → Git**, cloner le dépôt.
`node_modules` et `.env` sont gitignorés (normal, voir étapes 3 et 4).

**Option B — Upload** : envoyer `backend/` et `frontend/` par le Gestionnaire de
fichiers / SFTP, **sans** `node_modules`.

---

## 3. Configurer les variables d'environnement

Deux méthodes, au choix (les variables hPanel priment sur `.env`) :

**Via hPanel** (préféré pour les secrets) : dans l'écran de config Node.js,
section *Environment variables*, ajouter chaque clé ci-dessous.

**Via fichier** : créer `backend/.env` (jamais commité) :

```env
NODE_ENV=production
# PORT : NE PAS définir — Passenger le fournit.

# MySQL managé (valeurs de l'étape 1)
DATABASE_URL=mysql://u123456789_admin:MOTDEPASSE@localhost:3306/u123456789_codialis

# Secret JWT : long et aléatoire (≥32 caractères)
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=colle_ici_une_longue_chaine_aleatoire
JWT_EXPIRES=12h

# Premier patron (utilisé une seule fois par db:seed-admin)
ADMIN_NAME=Direction
ADMIN_EMAIL=admin@codialis.com
ADMIN_PASSWORD=un_mot_de_passe_fort

# Brevo — emails (identifiants employés, reset, newsletter)
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_NAME=Codialis
BREVO_SENDER_EMAIL=expediteur_valide@ton-domaine.com

# Lien de connexion inclus dans les emails (ton vrai domaine, en HTTPS)
APP_LOGIN_URL=https://ton-domaine.com/admin
```

> ⚠️ Si `DATABASE_URL` contient des caractères spéciaux (`@ : / #`) dans le mot de
> passe, les **url-encoder** (`@` → `%40`, etc.).

---

## 4. Créer l'application Node.js (hPanel)

hPanel → **Avancé → Node.js → Créer une application** :

| Champ                    | Valeur                          |
|--------------------------|---------------------------------|
| Version de Node          | `20.x`                          |
| Application root         | chemin vers `backend`           |
| Application URL          | ton domaine                     |
| Application startup file | `src/index.js`                  |

Puis :

1. **Run NPM Install** (bouton dans l'interface) — installe les dépendances de prod.
2. **Créer l'admin** (une seule fois) via le terminal de l'app (bouton *Run command*
   ou SSH), dans le dossier `backend/` :

   ```bash
   npm run db:seed-admin
   ```

   Crée le patron avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`. **Sans cette étape,
   aucun compte → login impossible.** Relancer la commande **réinitialise le mot
   de passe** de l'admin sur `ADMIN_PASSWORD` (utile si tu l'as perdu en prod).

3. **Start / Restart application**.

Vérifier : `https://ton-domaine.com/api/health` doit renvoyer `{"ok":true}`.
Puis se connecter sur `https://ton-domaine.com/admin`.

---

## 5. Redéployer une nouvelle version

```bash
git pull                 # ou ré-upload des fichiers modifiés
npm install              # si package.json a changé
```
Puis **Restart application** dans hPanel. Le schéma applique seul les nouvelles
tables/colonnes (idempotent) — pas de migration manuelle.

---

## Récap mensuel automatique (important)

Le récap RH mensuel est planifié **en process** (`node-cron`, 1er du mois 08:00
Paris). Sur un hébergement mutualisé, Passenger peut **endormir l'app** quand il
n'y a pas de trafic → le cron interne peut ne pas se déclencher.

Fiable à la place : un **Cron Job hPanel** (Avancé → Cron Jobs) qui réveille l'app,
par ex. une requête quotidienne :

```bash
curl -s https://ton-domaine.com/api/health > /dev/null
```

(ou pointer vers la route de récap si tu veux forcer l'envoi — voir
`backend/src/routes/recap.js`).

---

## Dépannage

| Symptôme                                   | Cause probable / fix                                                |
|--------------------------------------------|--------------------------------------------------------------------|
| Login échoue, « Identifiants incorrects »  | Admin pas seedé → `npm run db:seed-admin`.                          |
| 500 au démarrage, `JWT_SECRET missing`     | `JWT_SECRET` absent/trop court (<32) → en mettre un long.           |
| `ECONNREFUSED` / `Access denied` MySQL      | `DATABASE_URL` faux (hôte/prefix/mot de passe) ou droits user manquants. |
| Cookie de session pas gardé (déconnexion)  | `NODE_ENV=production` manquant (cookie `Secure` + `trust proxy`).   |
| `npm install` casse sur `bcrypt`           | Compilation native impossible → remplacer par `bcryptjs` (même API, import à changer). |
| Page `/admin` ou pages blanches            | CSP doit autoriser `unpkg` (déjà géré par `baseHelmet`) — vérifier qu'aucun proxy ne réécrit les en-têtes. |
| 404 sur les images `/assets` ou `/public`  | Dossier `frontend/` pas déployé à côté de `backend/`.              |

---

## Sécurité — checklist prod

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` long, unique, **jamais** la valeur d'exemple
- [ ] `ADMIN_PASSWORD` fort, changé après la 1re connexion
- [ ] `.env` **non** commité (déjà dans `.gitignore`)
- [ ] HTTPS actif (SSL Hostinger) sur tout le domaine
- [ ] `DATABASE_URL` avec un user MySQL dédié (pas root)
- [ ] Expéditeur Brevo (`BREVO_SENDER_EMAIL`) validé dans le compte Brevo
