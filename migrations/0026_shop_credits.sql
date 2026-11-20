-- Fictional shop tokens are NOT Play USD and cannot be wagered, transferred, or withdrawn.
-- The admin badge is purely cosmetic; isAdmin() must continue to rely on server-side owner email configuration.
CREATE TABLE IF NOT EXISTS shop_accounts (
 user_id TEXT PRIMARY KEY REFERENCES auth_users(id),
 credits INTEGER NOT NULL DEFAULT 0 CHECK(credits BETWEEN 0 AND 9007199254740991),
 admin_badge INTEGER NOT NULL DEFAULT 0 CHECK(admin_badge IN (0,1)),
 updated_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS shop_orders (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES auth_users(id),
 sku TEXT NOT NULL CHECK(sku IN ('small','plus','max','admin-badge')),
 playusd_cents INTEGER NOT NULL,
 credits_delta INTEGER NOT NULL,
 at_ms INTEGER NOT NULL,
 CHECK(
  (sku='small' AND playusd_cents=10000 AND credits_delta=100) OR
  (sku='plus' AND playusd_cents=25000 AND credits_delta=300) OR
  (sku='max' AND playusd_cents=50000 AND credits_delta=700) OR
  (sku='admin-badge' AND playusd_cents=0 AND credits_delta=-700)
 )
);
CREATE INDEX IF NOT EXISTS shop_orders_user_time ON shop_orders(user_id,at_ms DESC);

-- SQLite serializes the receipt insert, the wallet debit and the shop credit grant.
-- A rejected or duplicate receipt cannot modify balances.
CREATE TRIGGER IF NOT EXISTS shop_order_apply AFTER INSERT ON shop_orders BEGIN
 INSERT OR IGNORE INTO shop_accounts(user_id,credits,admin_badge,updated_ms)
 VALUES(NEW.user_id,0,0,NEW.at_ms);
 SELECT CASE
  WHEN NEW.sku<>'admin-badge' AND NOT EXISTS(
   SELECT 1 FROM playusd_wallets
   WHERE user_id=NEW.user_id AND initialized=1 AND cents>=NEW.playusd_cents
  ) THEN RAISE(ABORT,'Insufficient Play USD balance')
  WHEN NEW.sku='admin-badge' AND NOT EXISTS(
   SELECT 1 FROM shop_accounts
   WHERE user_id=NEW.user_id AND credits>=700 AND admin_badge=0
  ) THEN RAISE(ABORT,'Not enough shop credits or badge already owned')
 END;
 UPDATE playusd_wallets SET cents=cents-NEW.playusd_cents,updated_ms=NEW.at_ms
 WHERE user_id=NEW.user_id AND NEW.sku<>'admin-badge';
 UPDATE shop_accounts SET credits=credits+NEW.credits_delta,
  admin_badge=CASE WHEN NEW.sku='admin-badge' THEN 1 ELSE admin_badge END,
  updated_ms=NEW.at_ms WHERE user_id=NEW.user_id;
END;
