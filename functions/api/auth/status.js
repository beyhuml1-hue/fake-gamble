import { json, dbReady } from "../../_shared/auth.js";
export async function onRequestGet({ env }) {
  return json({ enabled: await dbReady(env) });
}
