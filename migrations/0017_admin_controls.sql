-- Owner moderation, online presence, and a durable audit trail.
ALTER TABLE auth_account_controls ADD COLUMN paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN (0,1));
CREATE TABLE IF NOT EXISTS auth_presence (
 user_id TEXT PRIMARY KEY REFERENCES auth_users(id),
 page TEXT NOT NULL DEFAULT 'Lobby',
 seen_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_presence_seen ON auth_presence(seen_ms DESC);
CREATE TABLE IF NOT EXISTS admin_account_audit (
 id TEXT PRIMARY KEY,
 actor_email TEXT NOT NULL,
 target_email TEXT NOT NULL,
 action TEXT NOT NULL,
 details TEXT,
 at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_account_audit_recent ON admin_account_audit(at_ms DESC);
