import {configured,currentUser,isAdmin,json,readBody,sameOrigin,hitRateLimit} from "../../_shared/auth.js";

// Closed-loop simulated card, never a bank-issued or payment-network instrument.
const CARD_UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function fingerprint(number,expiry,cvc){
 const data=new TextEncoder().encode("blockbet-sim-card-v1|"+number+"|"+expiry+"|"+cvc);
 const hash=await crypto.subtle.digest("SHA-256",data);
 return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,"0")).join("");
}
export async function onRequestGet({request,env}){
 if(!configured(env))return json({error:"Card simulator unavailable."},503);
 const user=await currentUser(request,env);
 if(!user)return json({error:"Sign in to use the card simulator."},401);
 if(!isAdmin(user,env))return json({demoOnly:true,shared:true,remainingCents:null});
 const row=await env.DB.prepare("SELECT balance_cents FROM demo_shared_voucher WHERE id=1").first();
 return json({demoOnly:true,shared:true,remainingCents:row?.balance_cents??null});
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
 if(!configured(env))return json({error:"Card simulator unavailable."},503);
 const user=await currentUser(request,env);
 if(!user)return json({error:"Sign in to add Play USD."},401);
 const input=await readBody(request);
 const id=input?.id,amount=input?.cents;
 const number=typeof input?.number==="string"?input.number.replace(/\s+/g,""):"";
 const expiry=typeof input?.expiry==="string"?input.expiry.trim():"";
 const cvc=typeof input?.cvc==="string"?input.cvc.trim():"";
 if(typeof id!=="string"||!CARD_UUID.test(id)||!Number.isSafeInteger(amount)||
   amount<100||amount>12500||!/^[0-9]{16}$/.test(number)||
   !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)||!/^[0-9]{3}$/.test(cvc))
   return json({error:"Enter valid simulated card details and $1–$125 amount."},400);
 if(!await hitRateLimit(env,"sim-card:"+user.id,3600000,8,Date.now()))
   return json({error:"Too many attempts. Please try later."},429);
 const hash=await fingerprint(number,expiry,cvc),now=Date.now();
 try{
  const [created,existing]=await env.DB.batch([
   env.DB.prepare(
    "INSERT OR IGNORE INTO demo_voucher_redemptions(id,user_id,cents,at_ms) "+
    "SELECT ?1,?2,?3,?4 FROM demo_shared_voucher "+
    "WHERE id=1 AND card_hash=?5 AND balance_cents>=?3"
   ).bind(id,user.id,amount,now,hash),
   env.DB.prepare("SELECT id FROM demo_voucher_redemptions WHERE id=?1 AND user_id=?2 AND cents=?3")
    .bind(id,user.id,amount),
  ]);
  if(created.meta?.changes===1||existing.results?.length)
    return json({ok:true,receipt:id,creditedCents:amount,simulated:true});
  return json({error:"Card declined or the shared simulated balance is too low."},409);
 }catch{
  return json({error:"Card simulator temporarily unavailable."},503);
 }
}
