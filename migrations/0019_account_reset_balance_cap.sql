-- Bring owner-set balances up to the $100m Play USD wallet cap.
-- Adds a reset signal so player devices clear local game history on the next account refresh.
CREATE TABLE auth_account_controls_new(
 user_id TEXT PRIMARY KEY REFERENCES auth_users(id),
 banned INTEGER NOT NULL DEFAULT 0 CHECK(banned IN(0,1)),
 balance_cents INTEGER CHECK(balance_cents BETWEEN 0 AND 10000000000),
 balance_revision TEXT,
 balance_mode TEXT NOT NULL DEFAULT 'set' CHECK(balance_mode IN('set','add','reset')),
 paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN(0,1)),
 luck_mode TEXT NOT NULL DEFAULT 'normal' CHECK(luck_mode IN('normal','hot','cold'))
);
INSERT INTO auth_account_controls_new(user_id,banned,balance_cents,balance_revision,balance_mode,paused,luck_mode)
 SELECT user_id,banned,balance_cents,balance_revision,balance_mode,paused,luck_mode FROM auth_account_controls;
DROP TABLE auth_account_controls;
ALTER TABLE auth_account_controls_new RENAME TO auth_account_controls;
