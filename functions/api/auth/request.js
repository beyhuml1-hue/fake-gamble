import { json, dbReady, emailReady, validEmail, sameOrigin, readBody, digest, randomCode, hitRateLimit } from "../../_shared/auth.js";

export async function sendCode(email, request, env) {
  if (!emailReady(env)) return json({error:"Email delivery is not configured."},503);
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

    let sentSuccessfully = false;
    let providerCode = null;
    let providerMessage = "";
    const subject = "Your BlockBet verification code";
    const textMessage = "BLOCKBET\n\nYour verification code: " + code + "\n\nEnter this code to finish creating your account. It expires in 10 minutes.\nNever share this code.\n\nDidn't request it? Ignore this email.";
    const htmlMessage = "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<meta name=\"color-scheme\" content=\"dark\"><title>BlockBet verification code</title>\n</head>\n<body style=\"margin:0;padding:0;background-color:#0b1924;color:#ffffff;font-family:Arial,Helvetica,sans-serif;\">\n<div style=\"display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;font-size:1px;line-height:1px;\">Your BlockBet verification code is inside and expires in 10 minutes.</div>\n<table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"border-collapse:collapse;background-color:#0b1924;\">\n<tr><td align=\"center\" style=\"padding:36px 16px 42px;\">\n<table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"max-width:520px;border-collapse:separate;\">\n<tr><td style=\"padding:0 4px 22px;\">\n<table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\">\n<tr><td bgcolor=\"#00e701\" width=\"44\" height=\"44\" align=\"center\" style=\"background-color:#00e701;border-radius:10px;color:#08230b;font-size:26px;font-weight:900;line-height:44px;\">B</td>\n<td style=\"padding-left:13px;color:#ffffff;font-size:23px;font-weight:800;letter-spacing:-0.5px;\">BlockBet</td></tr>\n</table></td></tr>\n<tr><td style=\"background-color:#172c3a;border:1px solid #314b5a;border-radius:16px;overflow:hidden;\">\n<table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">\n<tr><td height=\"5\" bgcolor=\"#00e701\" style=\"height:5px;line-height:5px;background-color:#00e701;font-size:1px;\">&nbsp;</td></tr>\n<tr><td style=\"padding:36px 28px 8px;\">\n<p style=\"margin:0 0 13px;color:#77ef92;font-size:11px;line-height:16px;font-weight:800;letter-spacing:2px;\">ACCOUNT VERIFICATION</p>\n<h1 style=\"margin:0 0 15px;color:#ffffff;font-size:30px;line-height:37px;font-weight:800;letter-spacing:-0.8px;\">You're almost in.</h1>\n<p style=\"margin:0;color:#c0ced7;font-size:15px;line-height:25px;\">Thanks for signing up to BlockBet. Enter the code below to verify your email and finish creating your account.</p>\n</td></tr>\n<tr><td style=\"padding:25px 28px 26px;\">\n<table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"background-color:#0e202c;border:1px solid #3b5c6d;border-radius:12px;\">\n<tr><td align=\"center\" style=\"padding:24px 8px 21px;\">\n<p style=\"margin:0 0 13px;color:#b2c4ce;font-size:11px;line-height:16px;font-weight:800;letter-spacing:1.5px;\">YOUR 6-DIGIT CODE</p>\n<p style=\"margin:0;color:#ffffff;font-size:39px;line-height:50px;font-weight:800;letter-spacing:9px;text-indent:9px;font-variant-numeric:tabular-nums;\">{{CODE}}</p>\n<p style=\"margin:14px 0 0;color:#8df9a5;font-size:12px;line-height:18px;font-weight:700;\">Expires in 10 minutes</p>\n</td></tr></table></td></tr>\n<tr><td style=\"padding:0 28px 34px;\">\n<table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">\n<tr><td bgcolor=\"#00e701\" width=\"3\" style=\"width:3px;background-color:#00e701;\">&nbsp;</td><td style=\"padding-left:15px;\">\n<p style=\"margin:0;color:#c0ced7;font-size:13px;line-height:21px;\"><strong style=\"color:#ffffff;\">Keep your code private.</strong> BlockBet will never ask you to share it with anyone.</p>\n</td></tr></table></td></tr>\n</table></td></tr>\n<tr><td align=\"center\" style=\"padding:24px 9px 0;\">\n<p style=\"margin:0 0 10px;color:#aabac5;font-size:12px;line-height:19px;\">Didn't request this code? You can safely ignore this email.</p>\n<p style=\"margin:0;color:#7f94a1;font-size:11px;line-height:18px;\">BlockBet &nbsp;&bull;&nbsp; Account security &nbsp;&bull;&nbsp; Automated email</p>\n</td></tr>\n</table></td></tr></table>\n</body></html>".replace("{{CODE}}", code);
    try {
      if (env.EMAIL) {
        // Native Cloudflare Email Sending binding, no external API key.
        await env.EMAIL.send({
          from: env.AUTH_FROM_EMAIL,
          to: email,
          subject,
          html: htmlMessage,
          text: textMessage,
        });
        sentSuccessfully = true;
      } else if (env.RESEND_API_KEY) {
        const sent = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: env.AUTH_FROM_EMAIL,
            to: [email],
            subject,
            html: htmlMessage,
            text: textMessage,
          }),
        });
        sentSuccessfully = sent.ok;
        providerCode = sent.status;
        if (!sent.ok) {
          const problem = await sent.json().catch(() => ({}));
          const reason = typeof problem?.name === "string" &&
            /^[a-zA-Z0-9_-]{1,60}$/.test(problem.name) ? problem.name : "unknown";
          // Avoid writing the API key, email address, or raw provider message to logs.
          console.warn("Resend rejected verification email", { status: sent.status, reason });
          if (sent.status === 401) providerMessage = "Resend rejected the API key (HTTP 401). The key must be replaced.";
          else if (sent.status === 403) providerMessage = "Resend blocked sending (HTTP 403). Confirm your sender domain is Verified and your account can email this address.";
          else if (sent.status === 422) providerMessage = "Resend rejected the sender or recipient (HTTP 422). Check the sender domain in Resend.";
          else if (sent.status === 429) providerMessage = "Resend email limit reached (HTTP 429). Try again later.";
          else providerMessage = "Resend rejected the email (HTTP " + sent.status + "; " + reason + ").";
        }
      }
    } catch {
      providerMessage = "Could not connect to the email service. Please retry.";
      console.warn("Email provider connection failed");
    }
    if (!sentSuccessfully) {
      await env.DB.prepare("DELETE FROM auth_otp WHERE email = ?1 AND digest = ?2").bind(email, codeHash).run();
      return json({ error: providerMessage || "Email sending failed. Please try again later." }, 502);
    }
    return json({ ok: true, message: "A six-digit code has been sent. Check your inbox and spam folder." });
  } catch {
    return json({ error: "Email service unavailable. Please try again later." }, 503);
  }
}

export async function onRequestPost({request,env}) {
  if (!sameOrigin(request)) return json({error:"Invalid request origin."},403);
  if (!(await dbReady(env))) return json({error:"Account service unavailable."},503);
  const input=await readBody(request);
  const email=validEmail(input?.email);
  if(!email) return json({error:"Enter a valid email."},400);
  const pending=await env.DB.prepare(
    "SELECT expires_ms FROM auth_pending WHERE email=?1"
  ).bind(email).first();
  if(!pending || pending.expires_ms < Date.now())
    return json({error:"Start sign-up again to get a code."},400);
  return sendCode(email,request,env);
}
