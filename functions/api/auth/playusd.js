import {configured,currentUser,json,readBody,sameOrigin,hitRateLimit} from "../../_shared/auth.js";

// One canonical Play USD account per signed-in user. All currency is fictional;
// game actions are reported by browser game engines, never audited real money.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT=100000000;
async function readBalance(env,user){
 return env.DB.prepare("SELECT cents,initialized FROM playusd_wallets WHERE user_id=?1").bind(user.id).first();
}
export async function onRequestGet({request,env}){
 if(!configured(env))return json({error:"Play USD unavailable."},503);
 const user=await currentUser(request,env);
 if(!user)return json({error:"Log in to sync your Play USD wallet."},401);
 try{
  const row=await readBalance(env,user);
  return row?.initialized===1?json({balance:row.cents,ready:true,fictional:true}):
    json({ready:false,fictional:true},200);
 }catch{return json({error:"Wallet temporarily offline."},503);}
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
 if(!configured(env))return json({error:"Play USD unavailable."},503);
 const user=await currentUser(request,env);
 if(!user)return json({error:"Log in to use the Play USD wallet."},401);
 const input=await readBody(request);
 const now=Date.now();
 try{
  if(input?.action==="initialize"){
   // One-time migration of the browser's existing normal balance. If Rain
   // or a transfer arrived first, preserve those credits when importing it.
   const balance=input.balance;
   if(!Number.isSafeInteger(balance)||balance<0||balance>LIMIT)
    return json({error:"Invalid Play USD balance."},400);
   await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO playusd_wallets(user_id,cents,initialized,updated_ms) VALUES(?1,?2,1,?3)")
      .bind(user.id,balance,now),
    env.DB.prepare("UPDATE playusd_wallets SET cents=MIN(?3,cents+?2),initialized=1,updated_ms=?4 WHERE user_id=?1 AND initialized=0")
      .bind(user.id,balance,LIMIT,now),
   ]);
   const wallet=await readBalance(env,user);
   return json({ok:true,balance:wallet.cents,ready:true,fictional:true});
  }
  if(input?.action==="game"){
   const delta=input.delta,id=input.id;
   if(typeof id!=="string"||!UUID.test(id)||!Number.isSafeInteger(delta)||
      delta===0||delta< -LIMIT||delta>LIMIT)
    return json({error:"Invalid game wallet operation."},400);
   if(!await hitRateLimit(env,"playusd-op:"+user.id,3600000,4000,now))
    return json({error:"Game wallet temporarily rate-limited."},429);
   const [written,existing]=await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO playusd_game_ops(id,user_id,delta_cents,at_ms) "+
     "SELECT ?1,?2,?3,?4 FROM playusd_wallets "+
     "WHERE user_id=?2 AND initialized=1 AND cents+?3 BETWEEN 0 AND ?5")
      .bind(id,user.id,delta,now,LIMIT),
    env.DB.prepare("SELECT 1 AS ok FROM playusd_game_ops WHERE id=?1 AND user_id=?2 AND delta_cents=?3")
      .bind(id,user.id,delta),
   ]);
   if(!written.meta?.changes&&!existing.results?.length)
    return json({error:"Not enough Play USD or wallet isn't ready."},409);
   const balance=(await readBalance(env,user)).cents;
   return json({ok:true,balance,fictional:true});
  }
  return json({error:"Unknown Play USD operation."},400);
 }catch{
  return json({error:"Play USD wallet temporarily unavailable."},503);
 }
}
