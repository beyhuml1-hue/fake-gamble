CREATE TABLE IF NOT EXISTS auth_account_controls (
  user_id TEXT PRIMARY KEY REFERENCES auth_users(id),
  banned INTEGER NOT NULL DEFAULT 0 CHECK (banned IN (0, 1)),
  balance_cents INTEGER CHECK (balance_cents BETWEEN 0 AND 100000000),
  balance_revision TEXT
);
