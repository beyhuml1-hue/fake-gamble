-- Isolated AI sandbox. Nothing here modifies the live wallet or rain ledger.
CREATE TABLE IF NOT EXISTS ai_messages(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN('user','assistant')), body TEXT NOT NULL, at_ms INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ai_messages_user ON ai_messages(user_id,at_ms DESC);
CREATE TABLE IF NOT EXISTS ai_memory(user_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_ms INTEGER NOT NULL, PRIMARY KEY(user_id,key));
CREATE TABLE IF NOT EXISTS ai_demo_players(id TEXT PRIMARY KEY, label TEXT NOT NULL UNIQUE, cents INTEGER NOT NULL DEFAULT 0 CHECK(cents>=0), last_active_ms INTEGER NOT NULL DEFAULT 0, joined_ms INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS ai_demo_ledger(id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES ai_demo_players(id), actor_id TEXT NOT NULL, delta_cents INTEGER NOT NULL, reason TEXT NOT NULL, at_ms INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ai_demo_ledger_recent ON ai_demo_ledger(at_ms DESC);
CREATE TABLE IF NOT EXISTS ai_demo_budget(day TEXT PRIMARY KEY, spent_cents INTEGER NOT NULL DEFAULT 0 CHECK(spent_cents>=0));
CREATE TABLE IF NOT EXISTS ai_demo_settings(id INTEGER PRIMARY KEY CHECK(id=1), daily_budget_cents INTEGER NOT NULL DEFAULT 10000, max_reward_cents INTEGER NOT NULL DEFAULT 1000, auto_rewards INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO ai_demo_settings(id) VALUES(1);
INSERT OR IGNORE INTO ai_demo_players(id,label,cents,last_active_ms,joined_ms) VALUES('demo-1','player123',25000,0,0),('demo-2','LuckyFox',12000,0,0),('demo-3','Nezuko',50000,0,0),('demo-4','CoinKing',7500,0,0),('demo-5','GemHunter',16000,0,0);
CREATE TRIGGER IF NOT EXISTS ai_demo_ledger_apply AFTER INSERT ON ai_demo_ledger BEGIN
 UPDATE ai_demo_players SET cents=cents+NEW.delta_cents WHERE id=NEW.player_id;
END;
