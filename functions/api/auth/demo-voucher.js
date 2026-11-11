import {configured,currentUser,isAdmin,json,readBody,sameOrigin,hitRateLimit} from "../../_shared/auth.js";

// A BlockBet-only closed-loop voucher. Never a payment card or bank instrument.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function fingerprint(code){
 const data=new TextEncoder().encode("blockbet-demo-voucher-v1|"+code);
 const result=await crypto.subtle.digest("SHA-256",data);
 return Array.from(new Uint8Array(result),v=>v.toString(16).padStart(2,"0")).join("");
}
export async function onRequestGet({request,env}){
 if(!configured(env))return json({error:"Voucher service unavailable."},503);
 const user=await currentUser(request,env);
 if(!user)return json({error:"Sign in to use the demo voucher."},401);
 if(!isAdmin(user,env))return json({demoOnly:true,shared:true,remainingCents:null});
 const row=await env.DB.prepare("SELECT balance_cents FROM demo_shared_voucher WHERE id=1").first();
 return json({demoOnly:true,shared:true,remainingCents:row?.balance_cents??null});
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
 if(!configured(env))return json({error:"Voucher unavailable."},503);
 const user=await currentUser(request,env);
 if(!user)return json({error:"Sign in to redeem demo credits."},401);
 const input=await readBody(request);
 const id=input?.id,amount=input?.cents;
 const code=typeof input?.code==="string"?input.code.trim().toUpperCase():"";
 if(typeof id!=="string"||!UUID.test(id)||!Number.isSafeInteger(amount)||amount<100||amount>12500||
    !/^PBDEMO-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code))
  return json({error:"Enter a valid voucher and $1–$125 amount."},400);
 if(!await hitRateLimit(env,"demo-voucher:"+user.id,3600000,8,Date.now()))
  return json({error:"Too many voucher attempts. Please try later."},429);
 const hash=await fingerprint(code);
 const now=Date.now();
 try{
  // D1 executes INSERT SELECT atomically. A trigger debits the single
  // shared pool and credits this player exactly once per unique receipt.
  const [written,existing]=await env.DB.batch([
   env.DB.prepare(
    "INSERT OR IGNORE INTO demo_voucher_redemptions(id,user_id,cents,at_ms) "+
    "SELECT ?1,?2,?3,?4 FROM demo_shared_voucher "+
    "WHERE id=1 AND code_hash=?5 AND balance_cents>=?3"
   ).bind(id,user.id,amount,now,hash),
   env.DB.prepare("SELECT id FROM demo_voucher_redemptions WHERE id=?1 AND user_id=?2 AND cents=?3")
    .bind(id,user.id,amount),
  ]);
  if(written.meta?.changes===1 || existing.results?.length)
    return json({ok:true,receipt:id,creditedCents:amount,demoOnly:true});
  return json({error:"Voucher invalid or its shared demo balance is too low."},409);
 }catch{
  return json({error:"Demo voucher temporarily unavailable."},503);
 }
}
