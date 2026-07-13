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

-- Flexible site content (portfolio / blog / testimonials / team).
-- The shape of each item is kept in `data` (jsonb) so the frontend
-- objects stay identical to before.
CREATE TABLE IF NOT EXISTS content (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL CHECK (type IN ('portfolio', 'blog', 'testimonials', 'team')),
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  position   BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_type_idx ON content(type);

-- Page-level singletons (hero text, featured case…), keyed by a stable name.
-- Each row is one whole settings object kept in `data` (jsonb).
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
