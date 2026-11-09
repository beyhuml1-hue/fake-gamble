import { json, dbReady, validEmail, sameOrigin, readBody, digest, sameHash, randomSecret, sessionCookie, hitRateLimit } from "../../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!(await dbReady(env))) return json({ error: "Email sign-in is not configured yet." }, 503);
  const input = await readBody(request);
  const email = validEmail(input?.email);
  const code = typeof input?.code === "string" ? input.code.trim() : "";
  if (!email || !/^[0-9]{6}$/.test(code)) return json({ error: "Enter the six-digit code from your email." }, 400);

  const now = Date.now();
  try {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipKey = await digest("ip:" + ip, env.AUTH_PEPPER);
    if (!(await hitRateLimit(env, "verify-ip:" + ipKey, 60 * 60 * 1000, 40, now))) {
      return json({ error: "Too many attempts. Please try again later." }, 429);
    }
    const pending = await env.DB.prepare("SELECT digest, expires_ms, attempts FROM auth_otp WHERE email = ?1").bind(email).first();
    if (!pending || pending.expires_ms < now || pending.attempts >= 5) {
      return json({ error: "Code expired or invalid. Request a new code." }, 401);
    }
    const bumped = await env.DB.prepare(
      "UPDATE auth_otp SET attempts = attempts + 1 WHERE email = ?1 AND digest = ?2 AND attempts < 5 AND expires_ms > ?3"
    ).bind(email, pending.digest, now).run();
    if (bumped.meta?.changes !== 1) return json({ error: "Code expired or invalid. Request a new code." }, 401);

    const enteredHash = await digest("otp:" + email + ":" + code, env.AUTH_PEPPER);
    if (!sameHash(enteredHash, pending.digest)) {
      return json({ error: "Incorrect code. Please try again." }, 401);
    }
    // One-use code, consumed before account creation.
    const removed = await env.DB.prepare("DELETE FROM auth_otp WHERE email = ?1 AND digest = ?2").bind(email, pending.digest).run();
    if (removed.meta?.changes !== 1) return json({ error: "Code already used. Request another." }, 401);

    await env.DB.prepare(
      "INSERT INTO auth_users (id, email, created_ms, last_login_ms) VALUES (?1, ?2, ?3, ?3) " +
      "ON CONFLICT(email) DO UPDATE SET last_login_ms = excluded.last_login_ms"
    ).bind(crypto.randomUUID(), email, now).run();
    const user = await env.DB.prepare("SELECT id, email FROM auth_users WHERE email = ?1").bind(email).first();
    const token = randomSecret();
    const tokenHash = await digest("session:" + token, env.AUTH_PEPPER);
    await env.DB.prepare("INSERT INTO auth_sessions (digest, user_id, expires_ms, created_ms) VALUES (?1, ?2, ?3, ?4)")
      .bind(tokenHash, user.id, now + 7 * 24 * 60 * 60_000, now).run();

    return json({ ok: true, user: { email: user.email } }, 200, { "Set-Cookie": sessionCookie(token) });
  } catch {
    return json({ error: "Could not verify that code. Try again." }, 503);
  }
}
