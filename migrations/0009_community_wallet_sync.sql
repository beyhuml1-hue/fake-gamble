-- Sync existing community Rain/transfer credits into the normal local Play USD wallet.
-- Store durable transaction events for once-per-device application; game balances remain local.
CREATE TABLE IF NOT EXISTS community_wallet_events (
 seq INTEGER PRIMARY KEY AUTOINCREMENT,
 event_key TEXT NOT NULL UNIQUE,
 user_id TEXT NOT NULL REFERENCES auth_users(id),
 delta_cents INTEGER NOT NULL CHECK(delta_cents BETWEEN -100000000 AND 100000000),
 kind TEXT NOT NULL CHECK(kind IN ('opening','rain','sent','received')),
 at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS community_wallet_events_user ON community_wallet_events(user_id,seq);
CREATE TABLE IF NOT EXISTS community_notifications (
 id TEXT PRIMARY KEY,
 recipient_id TEXT NOT NULL REFERENCES auth_users(id),
 sender_id TEXT NOT NULL REFERENCES auth_users(id),
 cents INTEGER NOT NULL CHECK(cents BETWEEN 1 AND 100000000),
 at_ms INTEGER NOT NULL,
 seen_ms INTEGER,
 FOREIGN KEY(id) REFERENCES community_transfers(id)
);
CREATE INDEX IF NOT EXISTS community_notifications_unread ON community_notifications(recipient_id,seen_ms,at_ms DESC);

-- Existing earned chat balance was never paid to the normal wallet; carry it over exactly once.
INSERT OR IGNORE INTO community_wallet_events(event_key,user_id,delta_cents,kind,at_ms)
 SELECT 'opening:'||user_id,user_id,cents,'opening',CAST(unixepoch()*1000 AS INTEGER)
 FROM community_profiles WHERE cents>0;

-- Each Rain winner's share is entered once on settlement (paid: 0 -> 1).
CREATE TRIGGER IF NOT EXISTS community_rain_wallet_credit AFTER UPDATE OF paid ON community_rain
WHEN OLD.paid=0 AND NEW.paid=1
BEGIN
 INSERT OR IGNORE INTO community_wallet_events(event_key,user_id,delta_cents,kind,at_ms)
 SELECT 'rain:'||NEW.round||':'||NEW.user_id,NEW.user_id,
 CAST(1000 / (SELECT COUNT(*) FROM community_rain WHERE round=NEW.round) AS INTEGER) +
 ((SELECT COUNT(*) FROM community_rain WHERE round=NEW.round AND seq<=NEW.seq) <=
  (1000 % (SELECT COUNT(*) FROM community_rain WHERE round=NEW.round))),
 'rain',CAST(unixepoch()*1000 AS INTEGER);
END;

-- Transfers are already validated by the original DB ledger and its balance trigger.
-- Never touch real money. Each sender/recipient receives a once-only wallet event.
CREATE TRIGGER IF NOT EXISTS community_transfer_wallet_events AFTER INSERT ON community_transfers
BEGIN
 INSERT OR IGNORE INTO community_wallet_events(event_key,user_id,delta_cents,kind,at_ms)
 VALUES('sent:'||NEW.id,NEW.sender,-NEW.cents,'sent',CAST(unixepoch()*1000 AS INTEGER));
 INSERT OR IGNORE INTO community_wallet_events(event_key,user_id,delta_cents,kind,at_ms)
 VALUES('received:'||NEW.id,NEW.recipient,NEW.cents,'received',CAST(unixepoch()*1000 AS INTEGER));
 INSERT OR IGNORE INTO community_notifications(id,recipient_id,sender_id,cents,at_ms)
 VALUES(NEW.id,NEW.recipient,NEW.sender,NEW.cents,CAST(unixepoch()*1000 AS INTEGER));
END;
