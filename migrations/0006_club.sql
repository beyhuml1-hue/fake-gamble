-- BlockBet Club: independent fictional Club Points, no real-world value and no casino balance conversion.
CREATE TABLE IF NOT EXISTS club_players (
 user_id TEXT PRIMARY KEY REFERENCES auth_users(id),
 public_id TEXT NOT NULL UNIQUE,
 handle TEXT NOT NULL,
 avatar TEXT NOT NULL DEFAULT '🪙',
 banner TEXT NOT NULL DEFAULT 'emerald',
 xp INTEGER NOT NULL DEFAULT 0 CHECK(xp>=0),
 points INTEGER NOT NULL DEFAULT 800 CHECK(points>=0),
 equip TEXT NOT NULL DEFAULT 'classic',
 last_seen_ms INTEGER NOT NULL DEFAULT 0,
 created_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS club_points_ledger (
 ref TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES club_players(user_id),
 delta INTEGER NOT NULL CHECK(delta BETWEEN -1000000 AND 1000000),
 created_ms INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS club_points_guard BEFORE INSERT ON club_points_ledger
BEGIN
 SELECT CASE WHEN COALESCE((SELECT points FROM club_players WHERE user_id=NEW.user_id), -99999999)+NEW.delta < 0 THEN RAISE(ABORT, 'insufficient Club Points') END;
END;
CREATE TRIGGER IF NOT EXISTS club_points_apply AFTER INSERT ON club_points_ledger
BEGIN
 UPDATE club_players SET points = points + NEW.delta WHERE user_id=NEW.user_id;
END;
CREATE TABLE IF NOT EXISTS club_xp_events (
 ref TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES club_players(user_id),
 kind TEXT NOT NULL, xp INTEGER NOT NULL CHECK(xp BETWEEN 0 AND 500),
 at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS club_xp_period ON club_xp_events(at_ms, user_id);
CREATE TRIGGER IF NOT EXISTS club_xp_apply AFTER INSERT ON club_xp_events
BEGIN
 UPDATE club_players SET xp=xp+NEW.xp WHERE user_id=NEW.user_id;
END;
CREATE TABLE IF NOT EXISTS club_inventory (
 user_id TEXT NOT NULL REFERENCES club_players(user_id), item TEXT NOT NULL,
 acquired_ms INTEGER NOT NULL, PRIMARY KEY(user_id,item)
);
CREATE TABLE IF NOT EXISTS club_packs (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES club_players(user_id),
 item TEXT NOT NULL, rarity TEXT NOT NULL, opened_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS club_friends (
 user_lo TEXT NOT NULL REFERENCES club_players(user_id),
 user_hi TEXT NOT NULL REFERENCES club_players(user_id),
 requested_by TEXT NOT NULL, accepted INTEGER NOT NULL DEFAULT 0,
 created_ms INTEGER NOT NULL,
 PRIMARY KEY(user_lo,user_hi), CHECK(user_lo<user_hi)
);
CREATE TABLE IF NOT EXISTS club_parties (
 code TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES club_players(user_id),
 created_ms INTEGER NOT NULL, expires_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS club_party_members (
 code TEXT NOT NULL REFERENCES club_parties(code),
 user_id TEXT NOT NULL REFERENCES club_players(user_id),
 joined_ms INTEGER NOT NULL, PRIMARY KEY(code,user_id)
);
CREATE TABLE IF NOT EXISTS club_duels (
 id TEXT PRIMARY KEY, maker TEXT NOT NULL REFERENCES club_players(user_id),
 joiner TEXT REFERENCES club_players(user_id), stake INTEGER NOT NULL CHECK(stake BETWEEN 10 AND 300),
 maker_side TEXT NOT NULL CHECK(maker_side IN ('heads','tails')),
 outcome TEXT CHECK(outcome IN ('heads','tails')), winner_id TEXT REFERENCES club_players(user_id),
 created_ms INTEGER NOT NULL, expires_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS club_duels_recent ON club_duels(created_ms DESC);
CREATE UNIQUE INDEX IF NOT EXISTS club_one_open_duel ON club_duels(maker) WHERE joiner IS NULL;
CREATE TABLE IF NOT EXISTS club_jackpot_entries (
 round INTEGER NOT NULL, user_id TEXT NOT NULL REFERENCES club_players(user_id),
 stake INTEGER NOT NULL CHECK(stake BETWEEN 10 AND 300),
 joined_ms INTEGER NOT NULL, PRIMARY KEY(round,user_id)
);
CREATE INDEX IF NOT EXISTS club_jackpot_round_index ON club_jackpot_entries(round);
CREATE TABLE IF NOT EXISTS club_jackpot_winners (
 round INTEGER PRIMARY KEY, winner_id TEXT NOT NULL REFERENCES club_players(user_id),
 pot INTEGER NOT NULL, settled_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS club_tournament_entries (
 week TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES club_players(user_id),
 joined_ms INTEGER NOT NULL, PRIMARY KEY(week,user_id)
);
