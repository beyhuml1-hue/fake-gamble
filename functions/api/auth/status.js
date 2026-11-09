import { json, dbReady } from "../../_shared/auth.js";
export async function onRequestGet({ env }) {
  return json({ enabled: await dbReady(env), emailVerificationReady: Boolean(env?.AUTH_FROM_EMAIL && (env?.EMAIL || env?.RESEND_API_KEY)) });
}
