ALTER TABLE playusd_wallets ADD COLUMN generation INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS case_rounds (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES auth_users(id),
 stake INTEGER NOT NULL CHECK(stake BETWEEN 100 AND 100000000),
 bundle INTEGER NOT NULL CHECK(bundle BETWEEN 0 AND 4),
 payout INTEGER NOT NULL CHECK(payout>=0),at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS case_rewards (
 user_id TEXT PRIMARY KEY REFERENCES auth_users(id),
 rebate_units INTEGER NOT NULL DEFAULT 0,
 owner_units INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS economy_wagers (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES auth_users(id),
 stake INTEGER NOT NULL CHECK(stake>0),at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS house_treasury (
 id INTEGER PRIMARY KEY CHECK(id=1),units INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO house_treasury(id) VALUES(1);
-- 10% of the theoretical 2% fee returns as rakeback (0.2% of wager).
-- The remaining 1.8% accrues to the requested shared owner wallet.
-- Remainders accumulate, so repeated micro bets cannot farm rounded credits.
CREATE TRIGGER IF NOT EXISTS economy_wager_rewards AFTER INSERT ON economy_wagers BEGIN
 INSERT OR IGNORE INTO case_rewards(user_id) VALUES(NEW.user_id);
 UPDATE playusd_wallets SET cents=MIN(9007199254740991,cents+CAST(((SELECT rebate_units FROM case_rewards WHERE user_id=NEW.user_id)+NEW.stake)/500 AS INTEGER)) WHERE user_id=NEW.user_id;
 UPDATE case_rewards SET rebate_units=(rebate_units+NEW.stake)%500 WHERE user_id=NEW.user_id;
 UPDATE house_treasury SET units=units+NEW.stake*9 WHERE id=1;
 UPDATE playusd_wallets SET cents=MIN(9007199254740991,cents+CAST((SELECT units/500 FROM house_treasury WHERE id=1) AS INTEGER))
 WHERE user_id=(SELECT w.user_id FROM playusd_wallets w JOIN auth_users u ON u.id=w.user_id WHERE w.initialized=1 AND u.email IN ('16laith.beyhum@beechenchill.manp.org.uk','beyhuml@gmail.com') ORDER BY u.email LIMIT 1);
 UPDATE house_treasury SET units=units%500 WHERE id=1 AND EXISTS(SELECT 1 FROM playusd_wallets w JOIN auth_users u ON u.id=w.user_id WHERE w.initialized=1 AND u.email IN ('16laith.beyhum@beechenchill.manp.org.uk','beyhuml@gmail.com'));
END;
CREATE TRIGGER IF NOT EXISTS case_round_apply AFTER INSERT ON case_rounds BEGIN
 UPDATE playusd_wallets SET cents=cents-NEW.stake+NEW.payout,updated_ms=NEW.at_ms WHERE user_id=NEW.user_id;
 INSERT INTO economy_wagers(id,user_id,stake,at_ms) VALUES('case:'||NEW.id,NEW.user_id,NEW.stake,NEW.at_ms);
END;
