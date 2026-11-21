CREATE TABLE IF NOT EXISTS economy_supply_actions (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  cents INTEGER,
  at_ms INTEGER NOT NULL
);
