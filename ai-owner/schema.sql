-- BlockBet AI Owner: STAGING ONLY. NO CONNECTION TO LIVE WALLET.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS ao_config (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 daily_budget INTEGER NOT NULL DEFAULT 5000 CHECK(daily_budget BETWEEN 0 AND 1000000),
 max_reward INTEGER NOT NULL DEFAULT 500 CHECK(max_reward BETWEEN 1 AND 10000),
 daily_login_bonus INTEGER NOT NULL DEFAULT 50 CHECK(daily_login_bonus BETWEEN 0 AND 1000),
 rain_amount INTEGER NOT NULL DEFAULT 100 CHECK(rain_amount BETWEEN 0 AND 1000),
 ai_enabled INTEGER NOT NULL DEFAULT 1 CHECK(ai_enabled IN(0,1))
);
INSERT OR IGNORE INTO ao_config(singleton) VALUES(1);

CREATE TABLE IF NOT EXISTS ao_players (
 id TEXT PRIMARY KEY,
 handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
 discord_id TEXT UNIQUE,
 balance INTEGER NOT NULL DEFAULT 0 CHECK(balance BETWEEN 0 AND 100000000),
 created_ms INTEGER NOT NULL,
 last_seen_ms INTEGER NOT NULL DEFAULT 0,
 loyalty_days INTEGER NOT NULL DEFAULT 0,
 is_test INTEGER NOT NULL DEFAULT 1 CHECK(is_test=1)
);
CREATE TABLE IF NOT EXISTS ao_ledger (
 ref TEXT PRIMARY KEY,
 player_id TEXT NOT NULL REFERENCES ao_players(id),
 delta INTEGER NOT NULL CHECK(delta BETWEEN -1000000 AND 1000000 AND delta<>0),
 kind TEXT NOT NULL CHECK(kind IN('seed','admin_grant','admin_remove','surprise','loyalty','login','giveaway','compensation','rain','test_bet')),
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 3 AND 240),
 actor TEXT NOT NULL CHECK(length(actor) BETWEEN 1 AND 120),
 day TEXT NOT NULL CHECK(length(day)=10),
 created_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ao_ledger_player_date ON ao_ledger(player_id,created_ms DESC);
CREATE INDEX IF NOT EXISTS ao_ledger_reward_date ON ao_ledger(day,kind);
CREATE TABLE IF NOT EXISTS ao_activity (
 player_id TEXT NOT NULL REFERENCES ao_players(id),
 day TEXT NOT NULL,
 messages INTEGER NOT NULL DEFAULT 0,
 sessions INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(player_id,day)
);
CREATE TABLE IF NOT EXISTS ao_bets (
 id TEXT PRIMARY KEY,
 player_id TEXT NOT NULL REFERENCES ao_players(id),
 game TEXT NOT NULL,
 stake INTEGER NOT NULL CHECK(stake>0),
 payout INTEGER NOT NULL CHECK(payout>=0),
 at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ao_bets_player_day ON ao_bets(player_id,at_ms);
CREATE TABLE IF NOT EXISTS ao_chat (
 id TEXT PRIMARY KEY,
 platform TEXT NOT NULL CHECK(platform IN('web','discord')),
 user_id TEXT,
 handle TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN('user','assistant','system')),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),
 at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ao_chat_recent ON ao_chat(platform,at_ms DESC);
CREATE TABLE IF NOT EXISTS ao_conversations (
 id TEXT PRIMARY KEY,
 surface TEXT NOT NULL CHECK(surface IN('web','discord')),
 actor_id TEXT NOT NULL,
 created_ms INTEGER NOT NULL,
 updated_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ao_messages (
 id TEXT PRIMARY KEY,
 conversation_id TEXT NOT NULL REFERENCES ao_conversations(id),
 role TEXT NOT NULL CHECK(role IN('user','assistant','tool')),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 12000),
 at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ao_messages_history ON ao_messages(conversation_id,at_ms DESC);
CREATE TABLE IF NOT EXISTS ao_memory (
 id TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL,
 fact TEXT NOT NULL CHECK(length(fact) BETWEEN 1 AND 350),
 updated_ms INTEGER NOT NULL,
 UNIQUE(actor_id,fact)
);
CREATE TABLE IF NOT EXISTS ao_audit (
 id TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL,
 surface TEXT NOT NULL,
 action TEXT NOT NULL,
 args TEXT NOT NULL,
 result TEXT NOT NULL,
 at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ao_audit_at ON ao_audit(at_ms DESC);
CREATE TABLE IF NOT EXISTS ao_announcements (
 id TEXT PRIMARY KEY,
 content TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN('sent','queued','failed')),
 actor TEXT NOT NULL,
 at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ao_reports (
 day TEXT PRIMARY KEY,
 status TEXT NOT NULL CHECK(status IN('pending','sent')),
 content TEXT,
 at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ao_rain (
 round INTEGER NOT NULL,
 player_id TEXT NOT NULL REFERENCES ao_players(id),
 joined_ms INTEGER NOT NULL,
 paid INTEGER NOT NULL DEFAULT 0 CHECK(paid IN(0,1)),
 PRIMARY KEY(round,player_id)
);

-- Every credit/debit is transactional, automatically updates player balances.
CREATE TRIGGER IF NOT EXISTS ao_guard BEFORE INSERT ON ao_ledger BEGIN
 SELECT CASE WHEN (SELECT balance FROM ao_players WHERE id=NEW.player_id) IS NULL
    THEN RAISE(ABORT,'player not found') END;
 SELECT CASE WHEN (SELECT balance FROM ao_players WHERE id=NEW.player_id)+NEW.delta < 0
    THEN RAISE(ABORT,'insufficient demo coins') END;
 SELECT CASE WHEN (SELECT balance FROM ao_players WHERE id=NEW.player_id)+NEW.delta > 100000000
    THEN RAISE(ABORT,'demo balance cap') END;
 -- Reward policy is enforced in SQLite, not by language-model instructions.
 SELECT CASE WHEN NEW.kind IN('admin_grant','surprise','loyalty','login','giveaway','compensation','rain')
     AND NEW.delta > (SELECT max_reward FROM ao_config WHERE singleton=1)
    THEN RAISE(ABORT,'individual reward limit') END;
 SELECT CASE WHEN NEW.kind IN('admin_grant','surprise','loyalty','login','giveaway','compensation','rain')
     AND NEW.delta + COALESCE((
       SELECT SUM(delta) FROM ao_ledger WHERE day=NEW.day AND
       kind IN('admin_grant','surprise','loyalty','login','giveaway','compensation','rain')),0)
       > (SELECT daily_budget FROM ao_config WHERE singleton=1)
    THEN RAISE(ABORT,'daily reward budget exhausted') END;
END;
CREATE TRIGGER IF NOT EXISTS ao_apply AFTER INSERT ON ao_ledger BEGIN
 UPDATE ao_players SET balance=balance+NEW.delta WHERE id=NEW.player_id;
END;

-- Imaginary players. Real players are never imported into this database.
INSERT OR IGNORE INTO ao_players(id,handle,created_ms,last_seen_ms,loyalty_days) VALUES
 ('demo-alex','Player123',1731000000000,1731000000000,12),
 ('demo-blair','LuckyBlair',1731000000000,1731000000000,6),
 ('demo-cleo','CleoCoins',1731000000000,1731000000000,18),
 ('demo-dex','DexTheAce',1731000000000,1731000000000,3),
 ('demo-erin','ErinPlays',1731000000000,1731000000000,9),
 ('demo-finn','FinnFlip',1731000000000,1731000000000,22),
 ('demo-gabi','GabiGems',1731000000000,1731000000000,14),
 ('demo-hugo','HugoRolls',1731000000000,1731000000000,7);
INSERT OR IGNORE INTO ao_ledger(ref,player_id,delta,kind,reason,actor,day,created_ms) VALUES
 ('seed-alex','demo-alex',2500,'seed','Imaginary opening balance','test-fixture','2026-11-01',1793500000000),
 ('seed-blair','demo-blair',600,'seed','Imaginary opening balance','test-fixture','2026-11-01',1793500000000),
 ('seed-cleo','demo-cleo',4100,'seed','Imaginary opening balance','test-fixture','2026-11-01',1793500000000),
 ('seed-dex','demo-dex',1200,'seed','Imaginary opening balance','test-fixture','2026-11-01',1793500000000),
 ('seed-erin','demo-erin',1800,'seed','Imaginary opening balance','test-fixture','2026-11-01',1793500000000),
 ('seed-finn','demo-finn',2700,'seed','Imaginary opening balance','test-fixture','2026-11-01',1793500000000),
 ('seed-gabi','demo-gabi',950,'seed','Imaginary opening balance','test-fixture','2026-11-01',1793500000000),
 ('seed-hugo','demo-hugo',3300,'seed','Imaginary opening balance','test-fixture','2026-11-01',1793500000000);
INSERT OR IGNORE INTO ao_bets(id,player_id,game,stake,payout,at_ms) VALUES
 ('sample-1','demo-alex','Mines',120,240,1794200000000),
 ('sample-2','demo-cleo','Dice',260,0,1794200100000),
 ('sample-3','demo-finn','Coinflip',180,360,1794200200000),
 ('sample-4','demo-erin','Plinko',200,20,1794200300000),
 ('sample-5','demo-hugo','Mines',300,650,1794200400000),
 ('sample-6','demo-gabi','Case opening',50,30,1794200500000);
