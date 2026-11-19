-- Remove the fixed Play USD wallet cap (using the maximum exactly representable JS integer in cents) while retaining balances and operation receipts.
CREATE TABLE IF NOT EXISTS playusd_wallets_unlimited (
 user_id TEXT PRIMARY KEY REFERENCES auth_users(id),
 cents INTEGER NOT NULL DEFAULT 0 CHECK(cents BETWEEN 0 AND 9007199254740991),
 initialized INTEGER NOT NULL DEFAULT 0 CHECK(initialized IN(0,1)),
 updated_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS playusd_game_ops_unlimited (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES auth_users(id),
 delta_cents INTEGER NOT NULL CHECK(delta_cents BETWEEN -9007199254740991 AND 9007199254740991 AND delta_cents<>0),
 at_ms INTEGER NOT NULL
);
INSERT INTO playusd_wallets_unlimited SELECT * FROM playusd_wallets;
INSERT INTO playusd_game_ops_unlimited SELECT * FROM playusd_game_ops;
DROP TRIGGER playusd_game_op_apply;
DROP TRIGGER playusd_social_apply;
DROP TRIGGER community_transfer_main_apply;
DROP TRIGGER IF EXISTS rain_contribution_apply;
DROP TRIGGER IF EXISTS pvp_host_escrow;
DROP TRIGGER IF EXISTS pvp_guest_escrow;
DROP TRIGGER IF EXISTS pvp_settle;
DROP TABLE playusd_game_ops;
DROP TABLE playusd_wallets;
ALTER TABLE playusd_wallets_unlimited RENAME TO playusd_wallets;
ALTER TABLE playusd_game_ops_unlimited RENAME TO playusd_game_ops;
CREATE INDEX IF NOT EXISTS playusd_game_ops_by_user ON playusd_game_ops(user_id,at_ms DESC);
CREATE TRIGGER IF NOT EXISTS playusd_game_op_apply AFTER INSERT ON playusd_game_ops BEGIN
 UPDATE playusd_wallets SET cents=MIN(9007199254740991,cents+NEW.delta_cents),updated_ms=NEW.at_ms WHERE user_id=NEW.user_id;
END;

-- Rain, voucher and transfer events feed the ONE normal Play USD ledger.
-- Missing recipients get an uninitialized wallet so their pre-existing browser balance
-- can still be imported the first time they sign in.
CREATE TRIGGER IF NOT EXISTS playusd_social_apply AFTER INSERT ON community_wallet_events BEGIN
 INSERT OR IGNORE INTO playusd_wallets(user_id,cents,initialized,updated_ms) VALUES(NEW.user_id,0,0,NEW.at_ms);
 UPDATE playusd_wallets
 SET cents=MAX(0,MIN(9007199254740991,cents+NEW.delta_cents)),updated_ms=NEW.at_ms
 WHERE user_id=NEW.user_id;
END;
CREATE TRIGGER IF NOT EXISTS community_transfer_main_apply AFTER INSERT ON community_transfers BEGIN
 INSERT OR IGNORE INTO community_wallet_events(event_key,user_id,delta_cents,kind,at_ms)
 VALUES('sent:'||NEW.id,NEW.sender,-NEW.cents,'sent',CAST(unixepoch()*1000 AS INTEGER));
 INSERT OR IGNORE INTO community_wallet_events(event_key,user_id,delta_cents,kind,at_ms)
 VALUES('received:'||NEW.id,NEW.recipient,NEW.cents,'received',CAST(unixepoch()*1000 AS INTEGER));
 INSERT OR IGNORE INTO community_notifications(id,recipient_id,sender_id,cents,at_ms)
 VALUES(NEW.id,NEW.recipient,NEW.sender,NEW.cents,CAST(unixepoch()*1000 AS INTEGER));
END;

-- Restore game and Rain triggers after replacing their referenced wallet table.
CREATE TRIGGER IF NOT EXISTS rain_contribution_apply AFTER INSERT ON rain_contributions BEGIN
 UPDATE playusd_wallets SET cents=cents-NEW.cents,updated_ms=NEW.at_ms WHERE user_id=NEW.user_id;
 INSERT OR IGNORE INTO rain_pots(round) VALUES(NEW.round);
 UPDATE rain_pots SET cents=cents+NEW.cents WHERE round=NEW.round;
 INSERT OR IGNORE INTO community_rain(round,user_id) VALUES(NEW.round,NEW.user_id);
END;

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
 UPDATE playusd_wallets SET cents=MIN(9007199254740991,cents+
   CASE WHEN OLD.status='waiting' THEN NEW.stake_cents
        WHEN NEW.winner_id IS NULL THEN NEW.stake_cents
        WHEN NEW.winner_id=NEW.host_id THEN 2*NEW.stake_cents ELSE 0 END),
   updated_ms=NEW.updated_ms WHERE user_id=NEW.host_id;
 UPDATE playusd_wallets SET cents=MIN(9007199254740991,cents+
   CASE WHEN NEW.winner_id IS NULL THEN NEW.stake_cents
        WHEN NEW.winner_id=NEW.guest_id THEN 2*NEW.stake_cents ELSE 0 END),
   updated_ms=NEW.updated_ms WHERE OLD.status='active' AND user_id=NEW.guest_id;
END;

