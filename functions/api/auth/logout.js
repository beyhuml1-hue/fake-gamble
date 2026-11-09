import { json, dbReady, sameOrigin, sessionToken, sessionCookie, digest } from "../../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!(await dbReady(env))) return json({ error: "Service not configured." }, 503);
  try {
    const token = sessionToken(request);
    if (token) {
      const tokenHash = await digest("session:" + token, env.AUTH_PEPPER);
      await env.DB.prepare("DELETE FROM auth_sessions WHERE digest = ?1").bind(tokenHash).run();
    }
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  } catch { return json({ error: "Could not sign out." }, 503); }
}
