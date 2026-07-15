CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  prenom        TEXT NOT NULL DEFAULT '',
  nom           TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('patron', 'employe')),
  poste         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Add columns to databases created before they existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS prenom TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS nom    TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS poste  TEXT NOT NULL DEFAULT '';
-- Account lifecycle: a new account starts unverified (owner must confirm via an
-- emailed link before credentials are issued). must_change_password forces a
-- password change on the first login after credentials are auto-generated.
-- Added with DEFAULT true so pre-existing (legacy) accounts, which already have
-- real passwords, stay able to log in; the default then flips to false so newly
-- created accounts start unverified. ADD COLUMN IF NOT EXISTS makes the backfill
-- run once only.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified        BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password  BOOLEAN NOT NULL DEFAULT false;
-- Vitrine (page d'accueil) : photo de profil et mise « à la une » du membre.
-- Les membres à la une remplacent l'ancienne liste content type 'team'.
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo    TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
-- Pas de solde de congés géré par l'appli — la direction gère le quota et le
-- payé/non-payé de tête, via le motif libre des absences.
ALTER TABLE users DROP COLUMN IF EXISTS leave_allowance;

-- Single-use, expiring tokens for account verification and password reset.
-- Only the SHA-256 hash of the token is stored; the raw token lives only in the
-- emailed link. used_at marks a token as spent.
CREATE TABLE IF NOT EXISTS user_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('verify', 'reset')),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_tokens_hash_idx ON user_tokens(token_hash);
CREATE INDEX IF NOT EXISTS user_tokens_user_idx ON user_tokens(user_id);

CREATE TABLE IF NOT EXISTS entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('sup', 'recup')),
  entry_date  DATE NOT NULL,
  hours       NUMERIC(6,2) NOT NULL CHECK (hours >= 0),
  motif       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'attente' CHECK (status IN ('attente', 'valide', 'refuse')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entries_employee_idx ON entries(employee_id);

CREATE TABLE IF NOT EXISTS presence (
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('present', 'tt', 'conge')),
  PRIMARY KEY (employee_id, day)
);

-- Règles de présence récurrentes (« semaine type ») posées par la direction.
-- Elles restent VIRTUELLES : jamais écrites dans `presence`. Le rendu du
-- planning les déplie à la volée, et une case cliquée manuellement (ligne
-- `presence`) prime sur la règle — pas besoin de table d'exceptions.
--   effect  : present | tt | conge | absence | formation (ce que la règle applique)
--   freq    : weekly | biweekly | monthly | daily  (biweekly = 1 semaine/2 ;
--             daily = chaque jour ouvré de la plage, sans jour fixe — utilisé
--             pour congé/absence/formation posés directement sur une période)
--   weekday : 0=lundi .. 6=dimanche            (weekly / biweekly ; NULL si daily)
--   monthday: 1..31                            (monthly ; NULL sinon)
--   half_day: NULL (journée) | am | pm          (demi-journée)
--   biweekly : la parité de semaine est calculée depuis start_date (ancre).
CREATE TABLE IF NOT EXISTS recurrences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  effect      TEXT NOT NULL CHECK (effect IN ('present', 'tt', 'conge', 'absence', 'formation')),
  freq        TEXT NOT NULL CHECK (freq IN ('weekly', 'biweekly', 'monthly', 'daily')),
  weekday     SMALLINT CHECK (weekday BETWEEN 0 AND 6),
  monthday    SMALLINT CHECK (monthday BETWEEN 1 AND 31),
  half_day    TEXT CHECK (half_day IN ('am', 'pm')),
  start_date  DATE NOT NULL,
  end_date    DATE,
  motif       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recurrences_emp_idx ON recurrences(employee_id);
-- Rejoue le CHECK sur `effect` pour les bases créées avant l'ajout de 'formation'
-- (CREATE TABLE IF NOT EXISTS ne modifie pas une contrainte déjà en place).
ALTER TABLE recurrences DROP CONSTRAINT IF EXISTS recurrences_effect_check;
ALTER TABLE recurrences ADD CONSTRAINT recurrences_effect_check CHECK (effect IN ('present', 'tt', 'conge', 'absence', 'formation'));
-- Idem pour `freq` : rejoue le CHECK afin d'autoriser 'daily' sur les bases
-- créées avant son ajout.
ALTER TABLE recurrences DROP CONSTRAINT IF EXISTS recurrences_freq_check;
ALTER TABLE recurrences ADD CONSTRAINT recurrences_freq_check CHECK (freq IN ('weekly', 'biweekly', 'monthly', 'daily'));

-- Absences ponctuelles sur une plage de dates. Circuit de validation identique
-- à `entries` (attente/valide/refuse). Pas de solde décompté — le type est
-- juste informatif (payé/non payé/etc. se gère via le motif, à l'œil).
--   half_day ne s'applique que si start_date = end_date (absence d'un seul jour).
CREATE TABLE IF NOT EXISTS absences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('tt', 'conge', 'absence', 'formation')),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  half_day    TEXT CHECK (half_day IN ('am', 'pm')),
  motif       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'attente' CHECK (status IN ('attente', 'valide', 'refuse')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS absences_employee_idx ON absences(employee_id);
-- Rejoue le CHECK sur `type` pour les bases créées avant la simplification à 4
-- types. La contrainte doit d'abord tomber : sinon le remap ci-dessous (vers
-- 'conge'/'absence', pas encore autorisés par l'ancienne contrainte) échoue.
ALTER TABLE absences DROP CONSTRAINT IF EXISTS absences_type_check;
UPDATE absences SET type = 'conge' WHERE type IN ('conge_paye', 'rtt');
UPDATE absences SET type = 'absence' WHERE type IN ('maladie', 'sans_solde', 'autre');
ALTER TABLE absences ADD CONSTRAINT absences_type_check CHECK (type IN ('tt', 'conge', 'absence', 'formation'));

-- Flexible site content (portfolio / blog / testimonials / team).
-- The shape of each item is kept in `data` (jsonb) so the frontend
-- objects stay identical to before.
CREATE TABLE IF NOT EXISTS content (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL CHECK (type IN ('portfolio', 'blog', 'testimonials', 'team')),
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  views      BIGINT NOT NULL DEFAULT 0,
  position   BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_type_idx ON content(type);

ALTER TABLE content ADD COLUMN IF NOT EXISTS views BIGINT NOT NULL DEFAULT 0;

-- Page-level singletons (hero text, featured case…), keyed by a stable name.
-- Each row is one whole settings object kept in `data` (jsonb).
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Newsletter subscribers (public form on /blog). Only an email address is
-- collected — the admin back office lists them and can remove one.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Page views statistics for global tracking (portfolio / blog).
CREATE TABLE IF NOT EXISTS page_views (
  page       TEXT PRIMARY KEY,
  count      BIGINT NOT NULL DEFAULT 0
);

-- Demandes de contact (formulaire public sur /contact). Le back-office (patron)
-- les liste, change leur statut de traitement et peut en supprimer une.
--   status : nouveau (reçu, non traité) | en_cours (pris en charge) | traite (clos)
CREATE TABLE IF NOT EXISTS contact_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL DEFAULT '',
  company    TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',
  project    TEXT NOT NULL DEFAULT '',
  budget     TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'en_cours', 'traite')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_requests_created_idx ON contact_requests(created_at DESC);

