// Cloudflare Pages Functions: server-side email verification and sessions.
// No secrets, OTPs or session tokens are ever sent to browser JavaScript.
export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
  });

export function configured(env) {
  return Boolean(env?.DB && env?.RESEND_API_KEY && env?.AUTH_PEPPER && env?.AUTH_FROM_EMAIL);
}

export function validEmail(input) {
  const email = typeof input === "string" ? input.trim().toLowerCase() : "";
  return email.length <= 254 &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(email) ? email : null;
}

export function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return Boolean(origin && origin === new URL(request.url).origin &&
    (request.headers.get("content-type") || "").startsWith("application/json"));
}

export async function readBody(request) {
  if (Number(request.headers.get("content-length") || 0) > 2048) return null;
  try {
    const body = await request.text();
    if (body.length > 2048) return null;
    return JSON.parse(body);
  } catch { return null; }
}

function base64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export function randomCode() {
  const number = new Uint32Array(1);
  crypto.getRandomValues(number);
  return String(number[0] % 1_000_000).padStart(6, "0");
}

export async function digest(value, pepper) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (x) => x.toString(16).padStart(2, "0")).join("");
}

export function sameHash(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}

// Returns false after repeated requests, using D1's atomic UPSERT for each bucket.
export async function hitRateLimit(env, key, windowMs, max, now) {
  await env.DB.prepare(
    "INSERT INTO auth_rate (key, window_ms, count) VALUES (?1, ?2, 1) " +
    "ON CONFLICT(key) DO UPDATE SET " +
    "count = CASE WHEN auth_rate.window_ms <= ?3 THEN 1 ELSE auth_rate.count + 1 END, " +
    "window_ms = CASE WHEN auth_rate.window_ms <= ?3 THEN ?2 ELSE auth_rate.window_ms END"
  ).bind(key, now, now - windowMs).run();
  const row = await env.DB.prepare("SELECT count FROM auth_rate WHERE key = ?1").bind(key).first();
  return (row?.count || 0) <= max;
}

const COOKIE = "bb_session";
export function sessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const value = cookies.split(";").map((v) => v.trim()).find((v) => v.startsWith(COOKIE + "="));
  const token = value ? value.slice(COOKIE.length + 1) : null;
  return token && /^[A-Za-z0-9_-]{40,100}$/.test(token) ? token : null;
}

export function sessionCookie(token, maxAge = 60 * 60 * 24 * 7) {
  return COOKIE + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAge;
}

export async function currentUser(request, env) {
  const token = sessionToken(request);
  if (!token) return null;
  const tokenHash = await digest("session:" + token, env.AUTH_PEPPER);
  return env.DB.prepare(
    "SELECT u.id, u.email FROM auth_sessions s INNER JOIN auth_users u ON u.id = s.user_id " +
    "WHERE s.digest = ?1 AND s.expires_ms > ?2"
  ).bind(tokenHash, Date.now()).first();
}

export async function dbReady(env) {
  if (!configured(env)) return false;
  try {
    await env.DB.prepare("SELECT email FROM auth_users LIMIT 1").first();
    await env.DB.prepare("SELECT email FROM auth_otp LIMIT 1").first();
    await env.DB.prepare("SELECT key FROM auth_rate LIMIT 1").first();
    await env.DB.prepare("SELECT digest FROM auth_sessions LIMIT 1").first();
    return true;
  } catch {
    return false;
  }
}
