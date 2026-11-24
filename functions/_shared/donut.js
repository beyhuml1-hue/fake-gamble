export const CASHIER = "onixxnex998";
export const PLAYER = /^\.?[A-Za-z0-9_]{1,16}$/;
export const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const MAX_AMOUNT = 100_000_000;
export const HEARTBEAT_AGE_MS = 20_000;

export function cashierConfigured(env) {
  return Boolean(env.DB && /^[A-Za-z0-9_-]{32,128}$/.test(env.DONUT_CASHIER_TOKEN || ""));
}

export async function cashierOnline(env, now = Date.now()) {
  if (!cashierConfigured(env) || env.DONUT_CASHIER_ENABLED !== "true") return false;
  const row = await env.DB.prepare("SELECT seen_at FROM donut_cashier_activity WHERE account=?")
    .bind(CASHIER).first();
  return Boolean(row && row.seen_at > now - HEARTBEAT_AGE_MS);
}

export function randomBelow(limit) {
  const buffer = new Uint32Array(1);
  const cutoff = 2 ** 32 - (2 ** 32 % limit);
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= cutoff);
  return buffer[0] % limit;
}

export function exactPayment(text) {
  const match = /^([.]?[A-Za-z0-9_]{1,16}) paid you \$ ?(\d+|\d{1,3}(?:,\d{3})+)(?:\.0{1,2})?$/.exec(text);
  if (!match) return null;
  const amount = Number(match[2].replaceAll(",", ""));
  return Number.isSafeInteger(amount) && amount > 0 ? { player: match[1], amount } : null;
}
