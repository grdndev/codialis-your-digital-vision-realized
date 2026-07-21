-- MySQL 8 schema (migrated from Postgres). Idempotent: CREATE TABLE IF NOT
-- EXISTS + indexes declared inline (MySQL has no CREATE INDEX IF NOT EXISTS).
-- Applied whole on boot via mysql2 with multipleStatements enabled (see db.js).
--
-- Type mapping vs the old Postgres schema:
--   UUID           -> CHAR(36)   (generated app-side with crypto.randomUUID)
--   TEXT/JSONB     -> VARCHAR / TEXT / LONGTEXT / JSON depending on size
--   BOOLEAN        -> TINYINT(1) (mapped back to JS boolean in db.js typeCast)
--   TIMESTAMPTZ    -> DATETIME
--   NUMERIC        -> DECIMAL

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36) PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  prenom        VARCHAR(255) NOT NULL DEFAULT '',
  nom           VARCHAR(255) NOT NULL DEFAULT '',
  email         VARCHAR(320) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(16)  NOT NULL CHECK (role IN ('patron', 'chef', 'employe')),
  poste         VARCHAR(255) NOT NULL DEFAULT '',
  -- Un compte démarre non vérifié (le patron confirme via un lien avant l'envoi
  -- des identifiants). must_change_password force le changement au 1er login.
  email_verified       TINYINT(1) NOT NULL DEFAULT 0,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  -- Vitrine : photo de profil (data URL base64 -> LONGTEXT) et mise « à la une ».
  photo         LONGTEXT NULL,
  featured      TINYINT(1) NOT NULL DEFAULT 0,
  -- Soldes « à ancre » : la direction saisit un solde réel + la date devient
  -- l'ancre ; le solde affiché est recalculé (voir balances.js). NULL = non défini.
  leave_balance DECIMAL(6,2),
  leave_anchor  DATE,
  hours_balance DECIMAL(7,2),
  hours_anchor  DATE,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Jetons à usage unique et expirants (vérification de compte / reset). Seul le
-- hash SHA-256 est stocké ; used_at marque un jeton consommé.
CREATE TABLE IF NOT EXISTS user_tokens (
  id         CHAR(36) PRIMARY KEY,
  user_id    CHAR(36) NOT NULL,
  kind       VARCHAR(16) NOT NULL CHECK (kind IN ('verify', 'reset')),
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX user_tokens_hash_idx (token_hash),
  INDEX user_tokens_user_idx (user_id),
  CONSTRAINT user_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entries (
  id          CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  kind        VARCHAR(16) NOT NULL CHECK (kind IN ('sup', 'recup')),
  entry_date  DATE NOT NULL,
  hours       DECIMAL(6,2) NOT NULL CHECK (hours >= 0),
  motif       VARCHAR(1000) NOT NULL DEFAULT '',
  status      VARCHAR(16) NOT NULL DEFAULT 'attente' CHECK (status IN ('attente', 'valide', 'refuse')),
  -- Heures sup payées (paie) vs mises en récup (alimentent le solde). Sans objet
  -- pour kind='recup'. La direction tranche à la validation.
  paid        TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX entries_employee_idx (employee_id),
  CONSTRAINT entries_employee_fk FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS presence (
  employee_id CHAR(36) NOT NULL,
  day         DATE NOT NULL,
  status      VARCHAR(16) NOT NULL CHECK (status IN ('present', 'tt', 'conge')),
  PRIMARY KEY (employee_id, day),
  CONSTRAINT presence_employee_fk FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Règles de présence récurrentes (« semaine type »). Restent virtuelles (jamais
-- écrites dans `presence`) : le planning les déplie à la volée.
--   effect : present|tt|conge|absence|formation   freq : weekly|biweekly|monthly|daily
--   weekday: 0=lundi..6=dimanche (weekly/biweekly)  monthday: 1..31 (monthly)
--   half_day: NULL(journée)|am|pm                   biweekly: parité depuis start_date
CREATE TABLE IF NOT EXISTS recurrences (
  id          CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  effect      VARCHAR(16) NOT NULL CHECK (effect IN ('present', 'tt', 'conge', 'absence', 'formation')),
  freq        VARCHAR(16) NOT NULL CHECK (freq IN ('weekly', 'biweekly', 'monthly', 'daily')),
  weekday     SMALLINT CHECK (weekday BETWEEN 0 AND 6),
  monthday    SMALLINT CHECK (monthday BETWEEN 1 AND 31),
  half_day    VARCHAR(2) CHECK (half_day IN ('am', 'pm')),
  start_date  DATE NOT NULL,
  end_date    DATE,
  motif       VARCHAR(1000) NOT NULL DEFAULT '',
  -- Seuls les congés/absences PAYÉS décomptent le solde de congés.
  paid        TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX recurrences_emp_idx (employee_id),
  CONSTRAINT recurrences_employee_fk FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Absences ponctuelles sur une plage. Circuit de validation (attente/valide/
-- refuse). Un congé/absence PAYÉ et VALIDÉ décompte le solde de congés.
--   half_day ne s'applique que si start_date = end_date.
CREATE TABLE IF NOT EXISTS absences (
  id          CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  type        VARCHAR(16) NOT NULL CHECK (type IN ('tt', 'conge', 'absence', 'formation')),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  half_day    VARCHAR(2) CHECK (half_day IN ('am', 'pm')),
  motif       VARCHAR(1000) NOT NULL DEFAULT '',
  status      VARCHAR(16) NOT NULL DEFAULT 'attente' CHECK (status IN ('attente', 'valide', 'refuse')),
  paid        TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX absences_employee_idx (employee_id),
  CONSTRAINT absences_employee_fk FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Contenu du site (portfolio / blog / testimonials). La forme de chaque item vit
-- dans `data` (JSON) pour garder les objets frontend identiques.
CREATE TABLE IF NOT EXISTS content (
  id         CHAR(36) PRIMARY KEY,
  type       VARCHAR(16) NOT NULL CHECK (type IN ('portfolio', 'blog', 'testimonials', 'team')),
  data       JSON NOT NULL,
  views      BIGINT NOT NULL DEFAULT 0,
  position   BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX content_type_idx (type)
);

-- Singletons de page (hero, cas à la une…), clés par un nom stable. `key` est un
-- mot réservé MySQL -> toujours entre backticks dans les requêtes.
CREATE TABLE IF NOT EXISTS settings (
  `key`      VARCHAR(191) PRIMARY KEY,
  data       JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         CHAR(36) PRIMARY KEY,
  email      VARCHAR(320) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS page_views (
  page       VARCHAR(191) PRIMARY KEY,
  count      BIGINT NOT NULL DEFAULT 0
);

-- Demandes de contact (formulaire public /contact).
--   status : nouveau (reçu) | en_cours (pris en charge) | traite (clos)
CREATE TABLE IF NOT EXISTS contact_requests (
  id         CHAR(36) PRIMARY KEY,
  name       VARCHAR(200) NOT NULL DEFAULT '',
  company    VARCHAR(200) NOT NULL DEFAULT '',
  email      VARCHAR(320) NOT NULL DEFAULT '',
  phone      VARCHAR(60)  NOT NULL DEFAULT '',
  project    VARCHAR(200) NOT NULL DEFAULT '',
  budget     VARCHAR(60)  NOT NULL DEFAULT '',
  message    TEXT,
  status     VARCHAR(16) NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'en_cours', 'traite')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX contact_requests_created_idx (created_at)
);

-- Veille / curation : articles agrégés des flux RSS (config/feeds.json).
--   status : new | ignored | later | published
--   guid   : identifiant du flux (dédup entre refreshs)
CREATE TABLE IF NOT EXISTS feed_items (
  id           CHAR(36) PRIMARY KEY,
  guid         VARCHAR(512) NOT NULL UNIQUE,
  source       VARCHAR(255) NOT NULL,
  category     VARCHAR(64)  NOT NULL,
  title        VARCHAR(512) NOT NULL,
  excerpt      TEXT,
  content      MEDIUMTEXT,
  image        VARCHAR(2048),
  link         VARCHAR(1024) NOT NULL,
  published_at DATETIME,
  status       VARCHAR(16) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'ignored', 'later', 'published')),
  fetched_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX feed_items_status_idx (status),
  INDEX feed_items_category_idx (category),
  INDEX feed_items_pubdate_idx (published_at)
);
