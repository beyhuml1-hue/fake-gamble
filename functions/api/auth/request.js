import { json, dbReady, validEmail, sameOrigin, readBody, digest, randomCode, hitRateLimit } from "../../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!(await dbReady(env))) return json({ error: "Email sign-in is not configured yet." }, 503);

  const input = await readBody(request);
  const email = validEmail(input?.email);
  if (!email) return json({ error: "Enter a valid email address." }, 400);

  const now = Date.now();
  try {
    // Limit both address and network requests. Raw IPs are never saved.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipKey = await digest("ip:" + ip, env.AUTH_PEPPER);
    const emailKey = await digest("email:" + email, env.AUTH_PEPPER);
    const allowedByIp = await hitRateLimit(env, "send-ip:" + ipKey, 60 * 60 * 1000, 12, now);
    const allowedByEmail = await hitRateLimit(env, "send-email:" + emailKey, 60 * 60 * 1000, 4, now);
    if (!allowedByIp || !allowedByEmail) return json({ error: "Too many requests. Please try again later." }, 429);

    const previous = await env.DB.prepare("SELECT sent_ms FROM auth_otp WHERE email = ?1").bind(email).first();
    if (previous && now - previous.sent_ms < 60_000) return json({ error: "Please wait a minute before requesting another code." }, 429);

    const code = randomCode();
    const codeHash = await digest("otp:" + email + ":" + code, env.AUTH_PEPPER);
    // Save before sending; delete the exact pending code if email delivery fails.
    await env.DB.prepare(
      "INSERT INTO auth_otp (email, digest, expires_ms, attempts, sent_ms) VALUES (?1, ?2, ?3, 0, ?4) " +
      "ON CONFLICT(email) DO UPDATE SET digest = excluded.digest, expires_ms = excluded.expires_ms, attempts = 0, sent_ms = excluded.sent_ms"
    ).bind(email, codeHash, now + 10 * 60_000, now).run();

    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.AUTH_FROM_EMAIL, to: [email],
        subject: "Your BlockBet sign-in code",
        text: "Your BlockBet verification code is " + code + ". It expires in 10 minutes. If you did not request it, ignore this email.",
        html: '<div style="font-family:Arial,sans-serif;background:#0f212e;color:white;padding:30px;border-radius:12px"><h1 style="color:#00e701">BlockBet</h1><p>Your one-time verification code is:</p><p style="font-size:38px;letter-spacing:10px;font-weight:bold">' + code + '</p><p>This code expires in 10 minutes. Do not share it with anyone.</p><small>If you did not request this code, ignore this email.</small></div>'
      }),
    });
    if (!sent.ok) {
      await env.DB.prepare("DELETE FROM auth_otp WHERE email = ?1 AND digest = ?2").bind(email, codeHash).run();
      return json({ error: "We couldn't send the email. Please try again later." }, 502);
    }
    return json({ ok: true, message: "A six-digit code has been sent. Check your inbox and spam folder." });
  } catch {
    return json({ error: "Email service unavailable. Please try again later." }, 503);
  }
}
