import {digest} from "./auth.js";
// An internal voucher identifier, deliberately NOT a payment-network card number.
export async function cardDetails(env) {
 const id=(await digest("demo-voucher-id",env.AUTH_PEPPER)).slice(0,12).toUpperCase();
 const code=(await digest("demo-voucher-code",env.AUTH_PEPPER)).slice(0,6).toUpperCase();
 return {number:"BB-DEMO-"+id,expiry:"12/99",code,demoOnly:true};
}
export async function initializeCard(env) {
 const details=await cardDetails(env);
 await env.DB.prepare("INSERT OR IGNORE INTO demo_shared_voucher(id,code_hash,balance_cents,created_ms) VALUES(1,?1,12500,?2)")
  .bind(await digest("demo-voucher-hash:"+details.number+":"+details.code,env.AUTH_PEPPER),Date.now()).run();
 return details;
}
