-- Upgrade base Rain to $1,000 (100,000 cents) without changing historical pots.
-- Existing contributions to the currently active pot are preserved.
DROP TRIGGER IF EXISTS rain_contribution_apply;
DROP TRIGGER IF EXISTS community_rain_wallet_credit;
UPDATE rain_pots SET cents=cents+99000 WHERE round=CAST(unixepoch()/420 AS INTEGER);
INSERT OR IGNORE INTO rain_pots(round,cents) VALUES(CAST(unixepoch()/420 AS INTEGER),100000);
CREATE TRIGGER IF NOT EXISTS rain_contribution_apply AFTER INSERT ON rain_contributions BEGIN
 UPDATE playusd_wallets SET cents=cents-NEW.cents,updated_ms=NEW.at_ms WHERE user_id=NEW.user_id;
 INSERT OR IGNORE INTO rain_pots(round,cents) VALUES(NEW.round,100000);
 UPDATE rain_pots SET cents=cents+NEW.cents WHERE round=NEW.round;
 INSERT OR IGNORE INTO community_rain(round,user_id) VALUES(NEW.round,NEW.user_id);
END;
DROP TRIGGER IF EXISTS community_rain_wallet_credit;
CREATE TRIGGER community_rain_wallet_credit AFTER UPDATE OF paid ON community_rain
WHEN OLD.paid=0 AND NEW.paid=1 BEGIN
 INSERT OR IGNORE INTO community_wallet_events(event_key,user_id,delta_cents,kind,at_ms)
 SELECT 'rain:'||NEW.round||':'||NEW.user_id,NEW.user_id,
 CAST(COALESCE((SELECT cents FROM rain_pots WHERE round=NEW.round),100000) / (SELECT COUNT(*) FROM community_rain WHERE round=NEW.round) AS INTEGER) +
 ((SELECT COUNT(*) FROM community_rain WHERE round=NEW.round AND seq<=NEW.seq) <=
  (COALESCE((SELECT cents FROM rain_pots WHERE round=NEW.round),100000) % (SELECT COUNT(*) FROM community_rain WHERE round=NEW.round))),
 'rain',CAST(unixepoch()*1000 AS INTEGER);
END;
