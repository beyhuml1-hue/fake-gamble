CREATE TABLE IF NOT EXISTS community_profiles (
  user_id TEXT PRIMARY KEY REFERENCES auth_users(id),
  public_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  cents INTEGER NOT NULL DEFAULT 0 CHECK (typeof(cents) = 'integer' AND cents >= 0)
);
CREATE TABLE IF NOT EXISTS community_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES community_profiles(user_id),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 240),
  at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS community_messages_recent ON community_messages(at_ms DESC);
CREATE TABLE IF NOT EXISTS community_rain (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  round INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES community_profiles(user_id),
  paid INTEGER NOT NULL DEFAULT 0,
  UNIQUE (round, user_id)
);
CREATE INDEX IF NOT EXISTS community_rain_unpaid ON community_rain(user_id, paid, round);
CREATE INDEX IF NOT EXISTS community_rain_order ON community_rain(round, seq);

CREATE TABLE IF NOT EXISTS community_transfers (
  id TEXT PRIMARY KEY,
  sender TEXT NOT NULL REFERENCES community_profiles(user_id),
  recipient TEXT NOT NULL REFERENCES community_profiles(user_id),
  cents INTEGER NOT NULL CHECK (cents BETWEEN 1 AND 100000000),
  CHECK (sender <> recipient)
);
CREATE TRIGGER IF NOT EXISTS community_transfer_apply AFTER INSERT ON community_transfers
BEGIN
  UPDATE community_profiles SET cents = cents - NEW.cents WHERE user_id = NEW.sender;
  UPDATE community_profiles SET cents = cents + NEW.cents WHERE user_id = NEW.recipient;
END;
