-- Closed-loop demo voucher and publicly marked player-reported big wins.
-- No real payment card, network funding or withdrawal capability.
ALTER TABLE community_messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'chat' CHECK(kind IN('chat','bigwin'));
CREATE TABLE IF NOT EXISTS demo_shared_voucher (
 id INTEGER PRIMARY KEY CHECK(id=1),
 code_hash TEXT NOT NULL CHECK(length(code_hash)=64),
 balance_cents INTEGER NOT NULL CHECK(balance_cents BETWEEN 0 AND 12500),
 created_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_voucher_redemptions (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES auth_users(id),
 cents INTEGER NOT NULL CHECK(cents BETWEEN 100 AND 12500),
 at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS demo_voucher_by_user ON demo_voucher_redemptions(user_id,at_ms DESC);
CREATE TRIGGER IF NOT EXISTS demo_voucher_apply AFTER INSERT ON demo_voucher_redemptions
BEGIN
 UPDATE demo_shared_voucher SET balance_cents=balance_cents-NEW.cents WHERE id=1;
 INSERT INTO community_wallet_events(event_key,user_id,delta_cents,kind,at_ms)
 VALUES('demo-voucher:'||NEW.id,NEW.user_id,NEW.cents,'received',NEW.at_ms);
END;
