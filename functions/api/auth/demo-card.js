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
 if(!configured(env))return json({error:"Wallet unavailable."},503);
 if(!await currentUser(request,env))return json({error:"Sign in to view your wallet."},401);
 return json({error:"Top-ups are disabled. Receive a transfer or join Rain."},410);
}
