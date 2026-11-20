import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readdirSync,readFileSync} from "node:fs";
import worker from "../blockbet-auth.worker.js";
import {issueSession} from "../functions/_shared/auth.js";
function fixture(){
 const db=new DatabaseSync(":memory:");
 const dir=new URL("../migrations/",import.meta.url);
 for(const file of readdirSync(dir).sort())db.exec(readFileSync(new URL(file,dir),"utf8"));
 const stmt=(sql,args=[])=>{
  const binds=Object.fromEntries(args.map((v,i)=>[String(i+1),v]));
  return {bind:(...v)=>stmt(sql,v),first:async()=>db.prepare(sql).get(binds),
   all:async()=>({results:db.prepare(sql).all(binds)}),
   run:async()=>({meta:db.prepare(sql).run(binds)})};
 };
 return {db,env:{AUTH_PEPPER:"shop-test",DB:{prepare:stmt}}};
}
test("Credit shop exchanges fictional Play USD atomically; badge never grants owner access",async()=>{
 const {db,env}=fixture(),origin="https://playblockbet.com";
 try{
  for(const who of ["alice","bob"]){
   db.prepare("INSERT INTO auth_users(id,email,created_ms,last_login_ms,password_hash) VALUES(?,?,1,1,'test')").run(who,who+"@example.com");
   db.prepare("INSERT INTO playusd_wallets(user_id,cents,initialized,updated_ms) VALUES(?,100000,1,1)").run(who);
  }
  const cookies={};
  for(const who of ["alice","bob"])cookies[who]=(await issueSession(env,{id:who,email:who+"@example.com"})).headers.get("Set-Cookie").split(";")[0];
  const get=(who,path="/api/auth/shop")=>worker.fetch(new Request(origin+path,{headers:{Cookie:cookies[who]||""}}),env);
  const post=(who,body,requestOrigin=origin)=>worker.fetch(new Request(origin+"/api/auth/shop",{
   method:"POST",headers:{Cookie:cookies[who]||"",Origin:requestOrigin,"Content-Type":"application/json"},body:JSON.stringify(body)
  }),env);
  assert.equal((await get("")).status,401);
  assert.equal((await post("alice",{action:"buy",sku:"max",id:crypto.randomUUID()},"https://evil.invalid")).status,403);
  assert.equal((await post("alice",{action:"buy",sku:"custom",id:crypto.randomUUID()})).status,400);
  const id=crypto.randomUUID(),purchase={action:"buy",sku:"max",id,playusdCents:0,credits:999999};
  assert.equal((await post("alice",purchase)).status,200);
  assert.equal((await post("alice",purchase)).status,200);
  assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='alice'").get().cents,50000);
  assert.equal(db.prepare("SELECT credits FROM shop_accounts WHERE user_id='alice'").get().credits,700);
  assert.equal(db.prepare("SELECT count(*) AS count FROM shop_orders").get().count,1);
  assert.equal((await post("bob",purchase)).status,409,"Can't replay another user's order");
  assert.equal((await post("alice",{action:"buy",sku:"plus",id})).status,409,"Can't alter existing order SKU");
  assert.equal((await post("alice",{action:"buy",sku:"admin-badge",id:crypto.randomUUID()})).status,200);
  const state=await (await get("alice")).json();
  assert.equal(state.adminBadge,true);
  assert.equal(state.credits,0);
  assert.equal(state.walletCents,50000);
  assert.equal(state.orders.length,2);
  assert.equal((await post("alice",{action:"buy",sku:"admin-badge",id:crypto.randomUUID()})).status,409);
  assert.equal((await get("alice","/api/auth/admin")).status,403,"Purchased badge must not grant admin access");
  assert.equal((await (await get("bob")).json()).adminBadge,false,"Other user unaffected");
  assert.equal((await post("alice",{action:"buy",sku:"max",id:crypto.randomUUID()})).status,200);
  assert.equal((await post("alice",{action:"buy",sku:"small",id:crypto.randomUUID()})).status,409,"Insufficient funds never debits wallet");
  assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='alice'").get().cents,0);
 }finally{db.close();}
});
