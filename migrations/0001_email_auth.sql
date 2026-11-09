-- Execute this SQL on your Cloudflare D1 database before enabling sign-in.
CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_ms INTEGER NOT NULL,
  last_login_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_otp (
  email TEXT PRIMARY KEY,
  digest TEXT NOT NULL,
  expires_ms INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  digest TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_ms INTEGER NOT NULL,
  created_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_ms);
CREATE TABLE IF NOT EXISTS auth_rate (
  key TEXT PRIMARY KEY,
  window_ms INTEGER NOT NULL,
  count INTEGER NOT NULL
);
