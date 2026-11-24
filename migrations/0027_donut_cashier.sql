CREATE TABLE IF NOT EXISTS donut_wallets (
  user_id TEXT PRIMARY KEY,
  player TEXT NOT NULL COLLATE NOCASE UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance BETWEEN 0 AND 9007199254740991)
);

CREATE TABLE IF NOT EXISTS donut_cashier_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  player TEXT NOT NULL COLLATE NOCASE,
  kind TEXT NOT NULL CHECK (kind IN ('link', 'deposit')),
  amount INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 100000000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'credited', 'review', 'expired')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS donut_one_open_by_player
  ON donut_cashier_intents(player) WHERE status IN ('open', 'review');
CREATE UNIQUE INDEX IF NOT EXISTS donut_one_open_by_user
  ON donut_cashier_intents(user_id) WHERE status IN ('open', 'review');

CREATE TABLE IF NOT EXISTS donut_cashier_receipts (
  id TEXT PRIMARY KEY,
  intent_id TEXT,
  player TEXT NOT NULL COLLATE NOCASE,
  amount INTEGER NOT NULL,
  observed_at INTEGER NOT NULL,
  receipt TEXT NOT NULL,
  exact INTEGER NOT NULL CHECK (exact IN (0, 1))
);

CREATE TRIGGER IF NOT EXISTS donut_apply_exact_receipt
AFTER INSERT ON donut_cashier_receipts
WHEN NEW.exact = 1 AND NEW.intent_id IS NOT NULL
BEGIN
  INSERT INTO donut_wallets(user_id, player, balance)
  SELECT user_id, player, NEW.amount FROM donut_cashier_intents
  WHERE id = NEW.intent_id AND status = 'open' AND kind = 'link';

  UPDATE donut_wallets SET balance = balance + NEW.amount
  WHERE user_id = (SELECT user_id FROM donut_cashier_intents WHERE id = NEW.intent_id
    AND status = 'open' AND kind = 'deposit') AND player = NEW.player;

  UPDATE donut_cashier_intents SET status = 'credited', resolved_at = NEW.observed_at
  WHERE id = NEW.intent_id AND status = 'open';
END;

CREATE TRIGGER IF NOT EXISTS donut_hold_rounded_receipt
AFTER INSERT ON donut_cashier_receipts
WHEN NEW.exact = 0 AND NEW.intent_id IS NOT NULL
BEGIN
  UPDATE donut_cashier_intents SET status = 'review', resolved_at = NEW.observed_at
  WHERE id = NEW.intent_id AND status = 'open';
END;

CREATE TABLE IF NOT EXISTS donut_cashier_withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES donut_wallets(user_id),
  player TEXT NOT NULL COLLATE NOCASE,
  amount INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 100000000),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'claimed', 'confirmed', 'cancelled', 'review')),
  created_at INTEGER NOT NULL,
  touched_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS donut_one_active_withdrawal
  ON donut_cashier_withdrawals(user_id) WHERE status IN ('queued', 'claimed', 'review');
CREATE INDEX IF NOT EXISTS donut_withdrawal_queue ON donut_cashier_withdrawals(status, created_at);

CREATE TABLE IF NOT EXISTS donut_cashier_activity (
  account TEXT PRIMARY KEY,
  seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS donut_game_reserve (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  balance INTEGER NOT NULL CHECK (balance BETWEEN 0 AND 9007199254740991)
);
INSERT OR IGNORE INTO donut_game_reserve(id, balance) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS donut_coinflips (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES donut_wallets(user_id),
  amount INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 100000000),
  pick TEXT NOT NULL CHECK (pick IN ('heads','tails')),
  outcome TEXT NOT NULL CHECK (outcome IN ('heads','tails')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS donut_coinflip_player_time ON donut_coinflips(user_id, created_at);

CREATE TRIGGER IF NOT EXISTS donut_settle_coinflip
AFTER INSERT ON donut_coinflips
BEGIN
  UPDATE donut_wallets SET balance = balance + CASE WHEN NEW.pick=NEW.outcome THEN NEW.amount ELSE -NEW.amount END
  WHERE user_id=NEW.user_id;
  UPDATE donut_game_reserve SET balance = balance + CASE WHEN NEW.pick=NEW.outcome THEN -NEW.amount ELSE NEW.amount END
  WHERE id=1;
END;

CREATE TRIGGER IF NOT EXISTS donut_reserve_withdrawal
AFTER INSERT ON donut_cashier_withdrawals
BEGIN
  UPDATE donut_wallets SET balance = balance - NEW.amount WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS donut_release_withdrawal
AFTER UPDATE OF status ON donut_cashier_withdrawals
WHEN OLD.status = 'claimed' AND NEW.status = 'cancelled'
BEGIN
  UPDATE donut_wallets SET balance = balance + NEW.amount WHERE user_id = NEW.user_id;
END;
