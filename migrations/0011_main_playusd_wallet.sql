-- Main Play USD balance ledger shared across signed-in accounts.
-- Supersedes the obsolete community_profiles.cents transfer reserve.
CREATE TABLE IF NOT EXISTS playusd_wallets (
 user_id TEXT PRIMARY KEY REFERENCES auth_users(id),
 cents INTEGER NOT NULL DEFAULT 0 CHECK(cents BETWEEN 0 AND 100000000),
 initialized INTEGER NOT NULL DEFAULT 0 CHECK(initialized IN(0,1)),
 updated_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS playusd_game_ops (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES auth_users(id),
 delta_cents INTEGER NOT NULL CHECK(delta_cents BETWEEN -100000000 AND 100000000 AND delta_cents<>0),
 at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS playusd_game_ops_by_user ON playusd_game_ops(user_id,at_ms DESC);
CREATE TRIGGER IF NOT EXISTS playusd_game_op_apply AFTER INSERT ON playusd_game_ops BEGIN
 UPDATE playusd_wallets SET cents=cents+NEW.delta_cents,updated_ms=NEW.at_ms WHERE user_id=NEW.user_id;
END;

DROP TRIGGER IF EXISTS community_transfer_apply;
DROP TRIGGER IF EXISTS community_transfer_wallet_events;
-- Rain, voucher and transfer events feed the ONE normal Play USD ledger.
-- Missing recipients get an uninitialized wallet so their pre-existing browser balance
-- can still be imported the first time they sign in.
CREATE TRIGGER IF NOT EXISTS playusd_social_apply AFTER INSERT ON community_wallet_events BEGIN
 INSERT OR IGNORE INTO playusd_wallets(user_id,cents,initialized,updated_ms) VALUES(NEW.user_id,0,0,NEW.at_ms);
 UPDATE playusd_wallets
 SET cents=MAX(0,MIN(100000000,cents+NEW.delta_cents)),updated_ms=NEW.at_ms
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
ALTER TABLE demo_shared_voucher ADD COLUMN card_hash TEXT;

-- The retired chat-only balance is no longer used anywhere. Its historic
-- opening credits remain represented by community_wallet_events.
ALTER TABLE community_profiles DROP COLUMN cents;
