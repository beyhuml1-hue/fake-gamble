import { configured, currentUser, json, readBody, sameOrigin } from "../../_shared/auth.js";
import { preparePlayer } from "./community.js";

// Authenticated event cursor: social payouts are issued by D1 triggers,
// then applied once to the existing device-local Play USD wallet.
const WALLET_EVENT_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function onRequestGet({request,env}){
 if(!configured(env))return json({error:"Wallet sync is unavailable."},503);
 const user=await currentUser(request,env);
 if(!user)return json({error:"Sign in to sync Play USD rewards."},401);
 const raw=new URL(request.url).searchParams.get("after")||"0";
 if(!/^\d{1,13}$/.test(raw))return json({error:"Invalid wallet cursor."},400);
 const after=Number(raw);
 try{
  await preparePlayer(env,user,Math.floor(Date.now()/420000));
  if(new URL(request.url).searchParams.get("notices")==="1"){
    const notices=await env.DB.prepare("SELECT n.id,p.label AS sender,n.cents,n.at_ms AS at FROM community_notifications n JOIN community_profiles p ON p.user_id=n.sender_id WHERE n.recipient_id=?1 AND n.seen_ms IS NULL ORDER BY n.at_ms DESC LIMIT 5").bind(user.id).all();
    return json({notifications:notices.results||[]});
  }
  const [rows,notices]=await Promise.all([
   env.DB.prepare("SELECT seq,delta_cents AS delta,kind,at_ms AS at FROM community_wallet_events WHERE user_id=?1 AND seq>?2 ORDER BY seq ASC LIMIT 101").bind(user.id,after).all(),
   env.DB.prepare("SELECT n.id,p.label AS sender,n.cents,n.at_ms AS at FROM community_notifications n JOIN community_profiles p ON p.user_id=n.sender_id WHERE n.recipient_id=?1 AND n.seen_ms IS NULL ORDER BY n.at_ms DESC LIMIT 5").bind(user.id).all(),
  ]);
  const events=(rows.results||[]).slice(0,100);
  return json({events,hasMore:(rows.results||[]).length>100,notifications:notices.results||[]});
 }catch{
  return json({error:"Wallet sync temporarily unavailable."},503);
 }
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
 if(!configured(env))return json({error:"Wallet sync unavailable."},503);
 const user=await currentUser(request,env);
 if(!user)return json({error:"Sign in to manage notifications."},401);
 const input=await readBody(request);
 if(input?.action!=="dismiss"||typeof input?.id!=="string"||!WALLET_EVENT_UUID.test(input.id))
  return json({error:"Invalid notification."},400);
 await env.DB.prepare("UPDATE community_notifications SET seen_ms=?1 WHERE id=?2 AND recipient_id=?3 AND seen_ms IS NULL")
 .bind(Date.now(),input.id,user.id).run();
 return json({ok:true});
}
