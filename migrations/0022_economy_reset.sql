-- One-time requested reset. Keep receipts, history and an explicit marker.
-- Expire escrow before setting balances, so old rooms cannot pay after reset.
CREATE TABLE IF NOT EXISTS economy_changes (id TEXT PRIMARY KEY,at_ms INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS economy_reset_balances(reset_id TEXT NOT NULL,user_id TEXT NOT NULL,cents INTEGER NOT NULL,initialized INTEGER NOT NULL,PRIMARY KEY(reset_id,user_id));
CREATE TRIGGER IF NOT EXISTS economy_reset_apply AFTER INSERT ON economy_changes
WHEN NEW.id='2026-11-card-cases' BEGIN
 INSERT OR IGNORE INTO economy_reset_balances SELECT NEW.id,user_id,cents,initialized FROM playusd_wallets;
 UPDATE pvp_rooms SET status='expired',winner_id=NULL,result_text='Economy reset',updated_ms=NEW.at_ms,finished_ms=NEW.at_ms WHERE status IN ('waiting','active');
 UPDATE community_rain SET paid=1 WHERE paid=0 AND round<CAST(unixepoch()/420 AS INTEGER);
 INSERT OR IGNORE INTO playusd_wallets(user_id,cents,initialized,updated_ms) SELECT id,100000,1,NEW.at_ms FROM auth_users;
 UPDATE playusd_wallets SET cents=100000,initialized=1,generation=generation+1,updated_ms=NEW.at_ms;
 UPDATE auth_account_controls SET balance_cents=100000,balance_revision='2026-11-card-cases',balance_mode='set';
 DELETE FROM auth_sessions;
 UPDATE case_rewards SET rebate_units=0,owner_units=0;
 UPDATE house_treasury SET units=0;
END;
INSERT OR IGNORE INTO economy_changes(id,at_ms) VALUES('2026-11-card-cases',CAST(unixepoch()*1000 AS INTEGER));
