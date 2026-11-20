import {configured,currentUser,json,readBody,sameOrigin,hitRateLimit} from "../../_shared/auth.js";

// Closed-loop virtual shop. There is NO payment processing, cash value, or admin grant.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ITEMS={
 small:{playusdCents:10000,credits:100},
 plus:{playusdCents:25000,credits:300},
 max:{playusdCents:50000,credits:700},
 "admin-badge":{playusdCents:0,credits:-700}
};

async function snapshot(env,user) {
 const [wallet,shop,history]=await Promise.all([
  env.DB.prepare("SELECT cents FROM playusd_wallets WHERE user_id=?1 AND initialized=1").bind(user.id).first(),
  env.DB.prepare("SELECT credits,admin_badge AS adminBadge FROM shop_accounts WHERE user_id=?1").bind(user.id).first(),
  env.DB.prepare("SELECT id,sku,playusd_cents AS playusdCents,credits_delta AS creditsDelta,at_ms AS atMs FROM shop_orders WHERE user_id=?1 ORDER BY at_ms DESC LIMIT 15").bind(user.id).all()
 ]);
 return {walletCents:wallet?.cents??0,credits:shop?.credits??0,adminBadge:shop?.adminBadge===1,orders:history.results||[],fictional:true};
}

export async function onRequestGet({request,env}){
 if(!configured(env))return json({error:"Shop unavailable."},503);
 const user=await currentUser(request,env);
 if(!user)return json({error:"Sign in to open your shop wallet."},401);
 try{return json(await snapshot(env,user));}
 catch{return json({error:"Shop database unavailable. Apply the shop migration."},503);}
}

export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
 if(!configured(env))return json({error:"Shop unavailable."},503);
 const user=await currentUser(request,env);
 if(!user)return json({error:"Sign in to use the credit shop."},401);
 const input=await readBody(request);
 if(!input || input.action!=="buy" || typeof input.sku!=="string" || !Object.hasOwn(ITEMS,input.sku)
   || typeof input.id!=="string" || !UUID.test(input.id))
   return json({error:"Invalid shop purchase."},400);
 const item=ITEMS[input.sku];
 try {
  const old=await env.DB.prepare("SELECT user_id,sku FROM shop_orders WHERE id=?1").bind(input.id).first();
  if(old) {
   if(old.user_id!==user.id || old.sku!==input.sku)return json({error:"Order reference already used."},409);
   return json({ok:true,replayed:true,...await snapshot(env,user)});
  }
  if(!await hitRateLimit(env,"shop-buy:"+user.id,3600000,100,Date.now()))
   return json({error:"Too many shop purchases. Try again later."},429);
  await env.DB.prepare("INSERT INTO shop_orders(id,user_id,sku,playusd_cents,credits_delta,at_ms) VALUES(?1,?2,?3,?4,?5,?6)")
   .bind(input.id,user.id,input.sku,item.playusdCents,item.credits,Date.now()).run();
  return json({ok:true,...await snapshot(env,user)});
 } catch {
  // On concurrent retries the receipt may have committed before this call failed.
  const old=await env.DB.prepare("SELECT user_id,sku FROM shop_orders WHERE id=?1").bind(input.id).first().catch(()=>null);
  if(old?.user_id===user.id&&old.sku===input.sku)return json({ok:true,replayed:true,...await snapshot(env,user)});
  return json({error:input.sku==="admin-badge"?"Badge already owned or insufficient shop credits.":"Not enough Play USD, or the wallet is not ready."},409);
 }
}
