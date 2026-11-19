CREATE TABLE IF NOT EXISTS admin_account_actions (
 id TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES auth_users(id),
 target_id TEXT NOT NULL REFERENCES auth_users(id),
 action TEXT NOT NULL CHECK(action IN('balance','add','subtract','ban','unban')),
 cents INTEGER,
 at_ms INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS admin_balance_apply AFTER INSERT ON admin_account_actions
WHEN NEW.action IN('balance','add','subtract') BEGIN
 INSERT OR IGNORE INTO playusd_wallets(user_id,cents,initialized,updated_ms) VALUES(NEW.target_id,0,1,NEW.at_ms);
 SELECT CASE WHEN NEW.cents<0 OR NEW.cents>9007199254740991 OR
  (NEW.action='subtract' AND NEW.cents>(SELECT cents FROM playusd_wallets WHERE user_id=NEW.target_id)) OR
  (NEW.action='add' AND NEW.cents>9007199254740991-(SELECT cents FROM playusd_wallets WHERE user_id=NEW.target_id))
  THEN RAISE(ABORT,'Balance outside supported range') END;
 UPDATE playusd_wallets SET cents=CASE NEW.action WHEN 'balance' THEN NEW.cents WHEN 'add' THEN cents+NEW.cents ELSE cents-NEW.cents END,initialized=1,updated_ms=NEW.at_ms WHERE user_id=NEW.target_id;
 INSERT INTO auth_account_controls(user_id,balance_cents,balance_revision,balance_mode)
 SELECT user_id,cents,NEW.id,'set' FROM playusd_wallets WHERE user_id=NEW.target_id
 ON CONFLICT(user_id) DO UPDATE SET balance_cents=excluded.balance_cents,balance_revision=excluded.balance_revision,balance_mode='set';
END;
