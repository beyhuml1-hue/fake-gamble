CREATE TABLE IF NOT EXISTS rain_pots (
 round INTEGER PRIMARY KEY, cents INTEGER NOT NULL DEFAULT 1000 CHECK(cents BETWEEN 1000 AND 10000000000)
);
CREATE TABLE IF NOT EXISTS rain_contributions (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES auth_users(id),round INTEGER NOT NULL,
 cents INTEGER NOT NULL CHECK(cents BETWEEN 1 AND 100000000),at_ms INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS rain_contribution_apply AFTER INSERT ON rain_contributions BEGIN
 UPDATE playusd_wallets SET cents=cents-NEW.cents,updated_ms=NEW.at_ms WHERE user_id=NEW.user_id;
 INSERT OR IGNORE INTO rain_pots(round) VALUES(NEW.round);
 UPDATE rain_pots SET cents=cents+NEW.cents WHERE round=NEW.round;
 INSERT OR IGNORE INTO community_rain(round,user_id) VALUES(NEW.round,NEW.user_id);
END;
DROP TRIGGER IF EXISTS community_rain_wallet_credit;
CREATE TRIGGER community_rain_wallet_credit AFTER UPDATE OF paid ON community_rain
WHEN OLD.paid=0 AND NEW.paid=1 BEGIN
 INSERT OR IGNORE INTO community_wallet_events(event_key,user_id,delta_cents,kind,at_ms)
 SELECT 'rain:'||NEW.round||':'||NEW.user_id,NEW.user_id,
 CAST(COALESCE((SELECT cents FROM rain_pots WHERE round=NEW.round),1000) / (SELECT COUNT(*) FROM community_rain WHERE round=NEW.round) AS INTEGER) +
 ((SELECT COUNT(*) FROM community_rain WHERE round=NEW.round AND seq<=NEW.seq) <=
  (COALESCE((SELECT cents FROM rain_pots WHERE round=NEW.round),1000) % (SELECT COUNT(*) FROM community_rain WHERE round=NEW.round))),
 'rain',CAST(unixepoch()*1000 AS INTEGER);
END;
