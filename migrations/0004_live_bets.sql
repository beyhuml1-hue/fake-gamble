-- Community demo activity: submitted settled bets only, no real funds.
CREATE TABLE IF NOT EXISTS auth_live_bets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id),
  label TEXT NOT NULL,
  game TEXT NOT NULL,
  wager INTEGER NOT NULL,
  payout INTEGER NOT NULL,
  at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_live_bets_newest ON auth_live_bets(at_ms DESC);
