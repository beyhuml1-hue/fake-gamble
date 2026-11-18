import { configured, currentUser, json, readBody, sameOrigin } from "../../_shared/auth.js";

export async function onRequestPost({request,env}) {
  if(!sameOrigin(request)) return json({error:"Invalid origin."},403);
  if(!configured(env)) return json({error:"Presence unavailable."},503);
  const user=await currentUser(request,env);
  if(!user) return json({error:"Sign in required."},401);
  const body=await readBody(request);
  const page=typeof body?.page==="string" && /^(Lobby|Chat|Stats|Race|Game: [a-z-]{2,30})$/.test(body.page) ? body.page : "Lobby";
  try {
    await env.DB.prepare("INSERT INTO auth_presence(user_id,page,seen_ms) VALUES(?1,?2,?3) ON CONFLICT(user_id) DO UPDATE SET page=excluded.page,seen_ms=excluded.seen_ms")
      .bind(user.id,page,Date.now()).run();
    return json({ok:true});
  }catch{return json({error:"Presence unavailable."},503);}
}
