import { configured, currentUser, json, readBody, sameOrigin } from "../../_shared/auth.js";
import { CASHIER, PLAYER, UUID, MAX_AMOUNT, cashierConfigured, cashierOnline, randomBelow } from "../../_shared/donut.js";

const MIN_DEPOSIT = 100_000;
const INTENT_MS = 15 * 60_000;

async function view(env, user) {
  const now = Date.now();
  const [wallet, intent, withdrawal, enabled] = await Promise.all([
    env.DB.prepare("SELECT player,balance FROM donut_wallets WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare(`SELECT id,kind,player,amount,
      CASE WHEN status='open' AND expires_at<=? THEN 'expired' ELSE status END AS status,expires_at
      FROM donut_cashier_intents WHERE user_id=? ORDER BY created_at DESC LIMIT 1`).bind(now, user.id).first(),
    env.DB.prepare("SELECT id,amount,status FROM donut_cashier_withdrawals WHERE user_id=? ORDER BY created_at DESC LIMIT 1")
      .bind(user.id).first(),
    cashierOnline(env, now),
  ]);
  return { wallet, intent, withdrawal, cashier: CASHIER, minimumDeposit: MIN_DEPOSIT, configured: true, enabled, coinflip: enabled && env.DONUT_GAMES_ENABLED === "true" };
}

async function expire(env, now) {
  await env.DB.prepare("UPDATE donut_cashier_intents SET status='expired',resolved_at=? WHERE status='open' AND expires_at<=?")
    .bind(now, now).run();
}

export async function onRequestGet({ request, env }) {
  if (!configured(env) || !cashierConfigured(env)) return json({ configured: false, error: "DSMP cashier is offline." }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: "Sign in to use the DonutSMP cashier." }, 401);
  return json(await view(env, user), 200, { "Cache-Control": "no-store" });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!configured(env) || !(await cashierOnline(env))) {
    return json({ error: "Wait for the cashier to come online before sending a payment." }, 503);
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: "Sign in to use the DonutSMP cashier." }, 401);
  const input = await readBody(request);
  if (!input || typeof input.id !== "string" || !UUID.test(input.id)) return json({ error: "Invalid request ID." }, 400);
  const now = Date.now();
  const amount = input.amount;
  await expire(env, now);
  const wallet = await env.DB.prepare("SELECT player FROM donut_wallets WHERE user_id=?").bind(user.id).first();
  try {
    if (input.action === "link") {
      if (wallet) return json({ error: "This account already has a linked Minecraft user." }, 409);
      const player = typeof input.player === "string" ? input.player.trim() : "";
      if (!PLAYER.test(player) || player.toLowerCase() === CASHIER.toLowerCase()) {
        return json({ error: "Enter your Java or dot-prefixed Bedrock username." }, 400);
      }
      const code = 1 + randomBelow(100);
      const write = await env.DB.prepare(`INSERT OR IGNORE INTO donut_cashier_intents
        (id,user_id,player,kind,amount,created_at,expires_at)
        SELECT ?,?,?,'link',?,?,? WHERE NOT EXISTS(SELECT 1 FROM donut_wallets WHERE user_id=? OR player=?)`)
        .bind(input.id, user.id, player, code, now, now + INTENT_MS, user.id, player).run();
      if (!write.meta.changes) return json({ error: "That Minecraft name or this account already has a link or request." }, 409);
    } else if (input.action === "deposit") {
      if (!wallet || !Number.isSafeInteger(amount) || amount < MIN_DEPOSIT || amount > MAX_AMOUNT) {
        return json({ error: "Link your account and enter a deposit from 100,000 to 100,000,000 coins." }, 400);
      }
      const write = await env.DB.prepare(`INSERT OR IGNORE INTO donut_cashier_intents
        (id,user_id,player,kind,amount,created_at,expires_at)
        SELECT ?,?,?,'deposit',?,?,? WHERE NOT EXISTS(
          SELECT 1 FROM donut_cashier_intents WHERE player=? AND resolved_at>? AND status='credited')`)
        .bind(input.id, user.id, wallet.player, amount, now, now + INTENT_MS, wallet.player, now - 30_000).run();
      if (!write.meta.changes) return json({ error: "Finish your current deposit or wait 30 seconds after the last deposit." }, 409);
    } else if (input.action === "withdraw") {
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_AMOUNT) return json({ error: "Enter an amount from 1 to 100M." }, 400);
      const write = await env.DB.prepare(`INSERT OR IGNORE INTO donut_cashier_withdrawals
        (id,user_id,player,amount,created_at,touched_at)
        SELECT ?,user_id,player,?,?,? FROM donut_wallets WHERE user_id=? AND balance>=?`)
        .bind(input.id, amount, now, now, user.id, amount).run();
      if (!write.meta.changes) {
        const duplicate = await env.DB.prepare("SELECT id FROM donut_cashier_withdrawals WHERE id=? AND user_id=? AND amount=?")
          .bind(input.id, user.id, amount).first();
        if (!duplicate) return json({ error: "Insufficient balance or a withdrawal is already open." }, 409);
      }
    } else return json({ error: "Unknown cashier action." }, 400);
    return json(await view(env, user), 200, { "Cache-Control": "no-store" });
  } catch {
    return json({ error: "The cashier could not record this request." }, 503);
  }
}
