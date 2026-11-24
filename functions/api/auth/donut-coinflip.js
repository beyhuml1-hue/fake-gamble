import { configured, currentUser, json, readBody, sameOrigin } from "../../_shared/auth.js";
import { cashierOnline, MAX_AMOUNT, randomBelow, UUID } from "../../_shared/donut.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!configured(env)) return json({ error: "DSMP Coinflip is offline." }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: "Sign in to play." }, 401);
  const body = await readBody(request);
  if (!body || !UUID.test(body.id || "") || !["heads", "tails"].includes(body.pick)
    || !Number.isSafeInteger(body.amount) || body.amount < 1_000 || body.amount > MAX_AMOUNT) {
    return json({ error: "Choose a side and enter a stake from 1,000 to 100M DSMP." }, 400);
  }

  const [wallet, prior] = await Promise.all([
    env.DB.prepare("SELECT balance FROM donut_wallets WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT amount,pick,outcome FROM donut_coinflips WHERE id=? AND user_id=?").bind(body.id, user.id).first(),
  ]);
  if (!wallet) return json({ error: "Link your Minecraft account before playing." }, 409);
  if (prior) {
    if (prior.amount !== body.amount || prior.pick !== body.pick) return json({ error: "This round ID was already used." }, 409);
    return json({ ...prior, payout: prior.pick === prior.outcome ? prior.amount * 2 : 0, balance: wallet.balance });
  }
  if (env.DONUT_GAMES_ENABLED !== "true" || !(await cashierOnline(env))) {
    return json({ error: "DSMP Coinflip is paused." }, 503);
  }
  const outcome = randomBelow(2) === 0 ? "heads" : "tails";
  const now = Date.now();
  const [write, settled, updated] = await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO donut_coinflips(id,user_id,amount,pick,outcome,created_at)
      SELECT ?,user_id,?,?,?,? FROM donut_wallets WHERE user_id=? AND balance>=?
      AND EXISTS(SELECT 1 FROM donut_game_reserve WHERE id=1 AND balance>=?)`)
      .bind(body.id, body.amount, body.pick, outcome, now, user.id, body.amount, body.amount),
    env.DB.prepare("SELECT amount,pick,outcome FROM donut_coinflips WHERE id=? AND user_id=?").bind(body.id, user.id),
    env.DB.prepare("SELECT balance FROM donut_wallets WHERE user_id=?").bind(user.id),
  ]);
  const round = settled.results[0];
  if (!round) return json({ error: "Insufficient DSMP or the prize reserve is too low for that stake." }, 409);
  if (!write.meta.changes && (round.amount !== body.amount || round.pick !== body.pick)) {
    return json({ error: "This round ID was already used." }, 409);
  }
  return json({ ...round, payout: round.pick === round.outcome ? round.amount * 2 : 0, balance: updated.results[0].balance });
}
