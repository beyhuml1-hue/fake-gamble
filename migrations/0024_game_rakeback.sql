-- Apply the debit before its rebate. Independent AFTER INSERT triggers can
-- execute in reverse creation order, which would lose rebates at the cap.
DROP TRIGGER IF EXISTS playusd_game_op_apply;
CREATE TRIGGER playusd_game_op_apply AFTER INSERT ON playusd_game_ops BEGIN
 UPDATE playusd_wallets SET cents=MIN(9007199254740991,cents+NEW.delta_cents),updated_ms=NEW.at_ms WHERE user_id=NEW.user_id;
 INSERT OR IGNORE INTO economy_wagers(id,user_id,stake,at_ms)
 SELECT 'game:'||NEW.id,NEW.user_id,-NEW.delta_cents,NEW.at_ms WHERE NEW.delta_cents<0;
END;
