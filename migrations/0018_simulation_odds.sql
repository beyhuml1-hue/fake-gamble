-- Labelled play-money simulation mode for account-specific demo odds.
ALTER TABLE auth_account_controls ADD COLUMN luck_mode TEXT NOT NULL DEFAULT 'normal' CHECK(luck_mode IN ('normal','hot','cold'));
