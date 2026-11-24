import { json, readBody } from "../../_shared/auth.js";
import { CASHIER, PLAYER, UUID, MAX_AMOUNT, exactPayment } from "../../_shared/donut.js";

async function authorized(request, env) {
  const token = env.DONUT_CASHIER_TOKEN || "";
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return false;
  const encoder = new TextEncoder();
  const expected = "Bearer " + token;
  const supplied = request.headers.get("Authorization") || "";
  if (supplied.length !== expected.length) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(token), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const proof = await crypto.subtle.sign("HMAC", key, encoder.encode(expected));
  return crypto.subtle.verify("HMAC", key, proof, encoder.encode(supplied));
}

export async function onRequestPost({ request, env }) {
  if (!(await authorized(request, env))) return json({ error: "Unauthorized cashier." }, 401);
  const data = await readBody(request);
  if (["heartbeat", "claim"].includes(data?.action)) {
    if (typeof data.account !== "string" || data.account.toLowerCase() !== CASHIER.toLowerCase()) {
      return json({ error: "Wrong cashier account." }, 403);
    }
    if (env.DONUT_CASHIER_ENABLED !== "true") return json({});
    const now = Date.now();
    await env.DB.prepare(`INSERT INTO donut_cashier_activity(account,seen_at) VALUES (?,?)
      ON CONFLICT(account) DO UPDATE SET seen_at=excluded.seen_at`).bind(CASHIER, now).run();
    if (data.action === "heartbeat") return json({ ok: true, online: true });
    const claim = await env.DB.prepare(`UPDATE donut_cashier_withdrawals SET status='claimed',touched_at=?
      WHERE id=(SELECT id FROM donut_cashier_withdrawals WHERE status='queued' ORDER BY created_at,id LIMIT 1)
      AND status='queued' RETURNING id,player,amount`).bind(now).first();
    return json(claim ? { ...claim, online: true } : { online: true });
  }
  if (!data || typeof data.id !== "string" || !UUID.test(data.id)) return json({ error: "Invalid event ID." }, 400);
  if (data.action === "complete") {
    if (!["confirmed", "cancelled", "review"].includes(data.status)) return json({ error: "Invalid status." }, 400);
    await env.DB.prepare("UPDATE donut_cashier_withdrawals SET status=?,touched_at=? WHERE id=? AND status='claimed'")
      .bind(data.status, Date.now(), data.id).run();
    return json({ ok: true });
  }
  if (data.action !== "deposit" || typeof data.player !== "string" || !PLAYER.test(data.player) || !Number.isSafeInteger(data.amount) || data.amount < 1
    || !Number.isSafeInteger(data.observed_at) || data.observed_at > Date.now() + 60_000
    || typeof data.receipt !== "string" || data.receipt.length > 220) return json({ error: "Invalid deposit receipt." }, 400);
  const echo = exactPayment(data.receipt);
  const exact = data.exact === true && echo && echo.player.toLowerCase() === data.player.toLowerCase()
    && echo.amount === data.amount && data.amount <= MAX_AMOUNT;
  await env.DB.prepare(`INSERT OR IGNORE INTO donut_cashier_receipts (id,intent_id,player,amount,observed_at,receipt,exact)
    VALUES(?,(SELECT id FROM donut_cashier_intents WHERE player=? AND status='open' AND created_at<=? AND expires_at>?
      AND ((?=1 AND amount=?) OR (?=0 AND kind='deposit')) LIMIT 1),?,?,?,?,?)`)
    .bind(data.id, data.player, data.observed_at, data.observed_at, exact ? 1 : 0, data.amount, exact ? 1 : 0,
      data.player, data.amount, data.observed_at, data.receipt, exact ? 1 : 0).run();
  return json({ ok: true });
}
