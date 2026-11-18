import {configured,currentUser,isAdmin,json,readBody,sameOrigin,hitRateLimit} from "../../_shared/auth.js";
import {initializeCard} from "../../_shared/demo-voucher.js";
const UUID=/^[a-f0-9-]{36}$/i;
// Voucher works only inside BlockBet; it is not accepted by payment networks.
export async function onRequestGet({request,env}){
 if(!configured(env))return json({error:"Demo voucher unavailable."},503);
 const user=await currentUser(request,env);if(!user)return json({error:"Sign in required."},401);
 try{
  await initializeCard(env);
  if(!isAdmin(user,env))return json({demoOnly:true,shared:true,remainingCents:null});
  const row=await env.DB.prepare("SELECT balance_cents FROM demo_shared_voucher WHERE id=1").first();
  return json({demoOnly:true,shared:true,remainingCents:row?.balance_cents??0});
 }catch{return json({error:"Demo voucher unavailable."},503);}
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return json({error:"Invalid origin."},403);
 if(!configured(env))return json({error:"Demo voucher unavailable."},503);
 const user=await currentUser(request,env);if(!user)return json({error:"Sign in required."},401);
 const input=await readBody(request),cents=input?.cents,id=input?.id;
 if(!UUID.test(id||"")||!Number.isSafeInteger(cents)||cents<100||cents>12500)
  return json({error:"Enter a voucher amount between $1 and $125."},400);
 const details=await initializeCard(env);
 if(input.number!==details.number||input.expiry!==details.expiry||input.code!==details.code)
  return json({error:"Demo card details are invalid."},400);
 if(!await hitRateLimit(env,"demo-voucher:"+user.id,3600000,12,Date.now()))
  return json({error:"Too many demo card attempts."},429);
 try {
  const now=Date.now();
  const [inserted,already]=await env.DB.batch([
   env.DB.prepare("INSERT OR IGNORE INTO demo_voucher_redemptions(id,user_id,cents,at_ms) "+
    "SELECT ?1,?2,?3,?4 FROM playusd_wallets w WHERE w.user_id=?2 AND w.initialized=1 "+
    "AND w.cents+?3<=10000000000 AND (SELECT balance_cents FROM demo_shared_voucher WHERE id=1)>=?3")
    .bind(id,user.id,cents,now),
   env.DB.prepare("SELECT 1 FROM demo_voucher_redemptions WHERE id=?1 AND user_id=?2 AND cents=?3")
    .bind(id,user.id,cents)
  ]);
  if(!inserted.meta?.changes&&!already.results?.length)
   return json({error:"Insufficient shared demo-card funds, or wallet still syncing."},409);
  const row=await env.DB.prepare("SELECT balance_cents FROM demo_shared_voucher WHERE id=1").first();
  return json({ok:true,remainingCents:row.balance_cents,creditedCents:cents,demoOnly:true});
 }catch{return json({error:"Demo card charge could not complete."},503);}
}
