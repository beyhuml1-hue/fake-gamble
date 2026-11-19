-- The two explicitly requested identities share a balance, not permissions.
CREATE TRIGGER IF NOT EXISTS owner_wallet_mirror AFTER UPDATE OF cents,initialized ON playusd_wallets
WHEN (NEW.cents<>OLD.cents OR NEW.initialized<>OLD.initialized)
AND NEW.user_id IN (SELECT id FROM auth_users WHERE email IN ('16laith.beyhum@beechenchill.manp.org.uk','beyhuml@gmail.com'))
BEGIN
 UPDATE playusd_wallets SET cents=NEW.cents,initialized=NEW.initialized,updated_ms=NEW.updated_ms
 WHERE user_id<>NEW.user_id AND user_id IN (SELECT id FROM auth_users WHERE email IN ('16laith.beyhum@beechenchill.manp.org.uk','beyhuml@gmail.com'));
END;
CREATE TRIGGER IF NOT EXISTS owner_wallet_join AFTER INSERT ON playusd_wallets
WHEN NEW.user_id IN (SELECT id FROM auth_users WHERE email IN ('16laith.beyhum@beechenchill.manp.org.uk','beyhuml@gmail.com'))
BEGIN
 UPDATE playusd_wallets SET
 cents=COALESCE((SELECT cents FROM playusd_wallets WHERE user_id<>NEW.user_id AND initialized=1 AND user_id IN (SELECT id FROM auth_users WHERE email IN ('16laith.beyhum@beechenchill.manp.org.uk','beyhuml@gmail.com')) LIMIT 1),NEW.cents),
 initialized=CASE WHEN EXISTS(SELECT 1 FROM playusd_wallets WHERE user_id<>NEW.user_id AND initialized=1 AND user_id IN (SELECT id FROM auth_users WHERE email IN ('16laith.beyhum@beechenchill.manp.org.uk','beyhuml@gmail.com'))) THEN 1 ELSE NEW.initialized END
 WHERE user_id=NEW.user_id;
END;
