CREATE TABLE IF NOT EXISTS pvp_rooms_new (
 id TEXT PRIMARY KEY,
 game TEXT NOT NULL CHECK(game IN ('pool','connect-four','mines-battles','uno','chess')),
 host_id TEXT NOT NULL REFERENCES auth_users(id),
 guest_id TEXT REFERENCES auth_users(id),
 stake_cents INTEGER NOT NULL CHECK(stake_cents BETWEEN 10 AND 1000000),
 status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN('waiting','active','finished','cancelled','expired')),
 state_json TEXT NOT NULL,
 turn_no INTEGER NOT NULL DEFAULT 0,
 turn_id TEXT REFERENCES auth_users(id),
 winner_id TEXT REFERENCES auth_users(id),
 result_text TEXT,
 created_ms INTEGER NOT NULL,
 updated_ms INTEGER NOT NULL,
 finished_ms INTEGER,
 CHECK (guest_id IS NULL OR guest_id <> host_id)
);
INSERT INTO pvp_rooms_new SELECT * FROM pvp_rooms;
DROP TABLE pvp_rooms;
ALTER TABLE pvp_rooms_new RENAME TO pvp_rooms;
CREATE INDEX IF NOT EXISTS pvp_open_rooms ON pvp_rooms(game,status,created_ms DESC);
CREATE INDEX IF NOT EXISTS pvp_by_host ON pvp_rooms(host_id,status);
CREATE INDEX IF NOT EXISTS pvp_by_guest ON pvp_rooms(guest_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS pvp_one_host_room ON pvp_rooms(host_id)
 WHERE status IN ('waiting','active');
CREATE UNIQUE INDEX IF NOT EXISTS pvp_one_guest_room ON pvp_rooms(guest_id)
 WHERE status='active' AND guest_id IS NOT NULL;

-- Escrow is debited in the same atomic statement as creation/join. Clients
-- must NOT use their optimistic wallet debit for PvP matches.
CREATE TRIGGER IF NOT EXISTS pvp_host_escrow AFTER INSERT ON pvp_rooms BEGIN
 UPDATE playusd_wallets SET cents=cents-NEW.stake_cents,updated_ms=NEW.created_ms
 WHERE user_id=NEW.host_id;
END;
CREATE TRIGGER IF NOT EXISTS pvp_guest_escrow AFTER UPDATE OF guest_id ON pvp_rooms
WHEN OLD.guest_id IS NULL AND NEW.guest_id IS NOT NULL BEGIN
 UPDATE playusd_wallets SET cents=cents-NEW.stake_cents,updated_ms=NEW.updated_ms
 WHERE user_id=NEW.guest_id;
END;

-- Exactly-once settlement: only status transitions out of active/waiting pay.
-- A cancelled waiting room returns the host's stake; a draw refunds both.
-- A winner receives both stakes. No cash payments or withdrawal mechanism.
CREATE TRIGGER IF NOT EXISTS pvp_settle AFTER UPDATE OF status ON pvp_rooms
WHEN OLD.status IN ('waiting','active') AND NEW.status IN ('finished','cancelled','expired')
BEGIN
 UPDATE playusd_wallets SET cents=MIN(10000000000,cents+
   CASE WHEN OLD.status='waiting' THEN NEW.stake_cents
        WHEN NEW.winner_id IS NULL THEN NEW.stake_cents
        WHEN NEW.winner_id=NEW.host_id THEN 2*NEW.stake_cents ELSE 0 END),
   updated_ms=NEW.updated_ms WHERE user_id=NEW.host_id;
 UPDATE playusd_wallets SET cents=MIN(10000000000,cents+
   CASE WHEN NEW.winner_id IS NULL THEN NEW.stake_cents
        WHEN NEW.winner_id=NEW.guest_id THEN 2*NEW.stake_cents ELSE 0 END),
   updated_ms=NEW.updated_ms WHERE OLD.status='active' AND user_id=NEW.guest_id;
END;

