-- Add password accounts to the existing BlockBet D1 database.
-- Apply once after 0001_email_auth.sql; existing accounts remain without a
-- password until their owner verifies the address and sets one.
ALTER TABLE auth_users ADD COLUMN password_hash TEXT;
ALTER TABLE auth_users ADD COLUMN password_salt TEXT;
ALTER TABLE auth_users ADD COLUMN password_iterations INTEGER;
CREATE TABLE IF NOT EXISTS auth_pending (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  expires_ms INTEGER NOT NULL,
  created_ms INTEGER NOT NULL
);
