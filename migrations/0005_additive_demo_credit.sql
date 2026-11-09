-- Allow one-time additive demo-credit grants without replacing a player's
-- existing local balance. The default preserves current admin 'set balance' behavior.
ALTER TABLE auth_account_controls ADD COLUMN balance_mode TEXT NOT NULL DEFAULT 'set' CHECK (balance_mode IN ('set', 'add'));
