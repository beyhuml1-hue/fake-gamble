import { json, dbReady, currentUser, sessionUser } from "../../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  if (!(await dbReady(env))) return json({ error: "Service not configured." }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user) return json({ authenticated: false }, 401);
    return json({ authenticated: true, user: await sessionUser(env, user) });
  } catch { return json({ error: "Session unavailable." }, 503); }
}
