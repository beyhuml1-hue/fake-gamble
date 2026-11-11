import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker from "../blockbet-auth.worker.js";
import {issueSession} from "../functions/_shared/auth.js";

function setup(){
 const db=new DatabaseSync(":memory:");
 const dir=new URL("../migrations/",import.meta.url);
 for(const file of readdirSync(dir).sort())db.exec(readFileSync(new URL(file,dir),"utf8"));
 const stmt=(sql,args=[])=>{
  const vals=Object.fromEntries(args.map((v,i)=>[String(i+1),v]));
  return {bind:(...xs)=>stmt(sql,xs),first:async()=>db.prepare(sql).get(vals),
   all:async()=>({results:db.prepare(sql).all(vals)}),
   run:async()=>({meta:db.prepare(sql).run(vals)}),
   execute:async()=>sql.trimStart().startsWith("SELECT")?
    {results:db.prepare(sql).all(vals),meta:{changes:0}}:
    {results:[],meta:db.prepare(sql).run(vals)}
  };
 };
 const DB={prepare:stmt,async batch(items){
  db.exec("BEGIN");try{const result=[];for(const item of items)result.push(await item.execute());db.exec("COMMIT");return result;}
  catch(e){db.exec("ROLLBACK");throw e;}
 }};
 return {db,DB};
}
const base="https://playblockbet.com";
test("Shared BlockBet-only demo voucher decrements one $125 virtual balance, rejects duplicates and preserves privacy",async()=>{
 const {db,DB}=setup();
 try{
  const env={AUTH_PEPPER:"test-secret",DB,ADMIN_EMAIL:"owner@example.com"};
  const voucher="PBDEMO-TST1-VR01";
  const bytes=new TextEncoder().encode("blockbet-demo-voucher-v1|"+voucher);
  const hashed=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),v=>v.toString(16).padStart(2,"0")).join("");
  db.prepare("INSERT INTO demo_shared_voucher(id,code_hash,balance_cents,created_ms) VALUES(1,?,12500,1)").run(hashed);
  const cookies={};
  for(const name of ["owner","alice","bob"]){
   const email=name+"@example.com";
   db.prepare("INSERT INTO auth_users(id,email,created_ms,last_login_ms,password_hash) VALUES(?,?,1,1,'test')").run(name,email);
   cookies[name]=(await issueSession(env,{id:name,email})).headers.get("Set-Cookie").split(";")[0];
  }
  const get=(who)=>worker.fetch(new Request(base+"/api/auth/demo-voucher",{headers:{Cookie:cookies[who]||""}}),env);
  const post=(who,body,origin=base)=>worker.fetch(new Request(base+"/api/auth/demo-voucher",{
   method:"POST",headers:{Cookie:cookies[who]||"",Origin:origin,"Content-Type":"application/json"},
   body:JSON.stringify(body)
  }),env);
  const payload=(cents,id=crypto.randomUUID())=>({id,cents,code:voucher});
  assert.equal((await (await get("alice")).json()).remainingCents,null);
  assert.equal((await (await get("owner")).json()).remainingCents,12500);
  assert.equal((await post("alice",payload(100),"https://other.example")).status,403);
  assert.equal((await post("",payload(100))).status,401);
  assert.equal((await post("alice",{...payload(100),code:"PBDEMO-FAKE-FAKE"})).status,409);
  const first=payload(5000);
  assert.equal((await post("alice",first)).status,200);
  assert.equal((await post("alice",first)).status,200,"A repeated receipt cannot debit twice");
  assert.equal(db.prepare("SELECT balance_cents FROM demo_shared_voucher").get().balance_cents,7500);
  assert.equal((await post("bob",payload(7500))).status,200);
  assert.equal(db.prepare("SELECT balance_cents FROM demo_shared_voucher").get().balance_cents,0);
  assert.equal((await post("owner",payload(100))).status,409);
  assert.equal(db.prepare("SELECT COALESCE(SUM(cents),0) AS total FROM demo_voucher_redemptions").get().total,12500);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM demo_voucher_redemptions").get().n,2);
  assert.deepEqual(db.prepare("SELECT delta_cents,kind FROM community_wallet_events WHERE user_id='alice'").all().map(row=>({...row})),[{delta_cents:5000,kind:"received"}]);
  assert.deepEqual(db.prepare("SELECT delta_cents,kind FROM community_wallet_events WHERE user_id='bob'").all().map(row=>({...row})),[{delta_cents:7500,kind:"received"}]);
  assert.doesNotMatch(JSON.stringify(await (await get("alice")).json()),/code_hash|PBDEMO-TST1/);
 }finally{db.close();}
});
test("Submitted big wins publish once to public chat and weekly rankings reflect actual submitted records",async()=>{
 const {db,DB}=setup();
 try{
  const env={AUTH_PEPPER:"another-test",DB},cookies={};
  for(const name of ["alice","bob"]){
   const email=name+"@example.com";
   db.prepare("INSERT INTO auth_users(id,email,created_ms,last_login_ms,password_hash) VALUES(?,?,1,1,'test')").run(name,email);
   cookies[name]=(await issueSession(env,{id:name,email})).headers.get("Set-Cookie").split(";")[0];
  }
  const bet=(who,body)=>worker.fetch(new Request(base+"/api/auth/live-bets",{
   method:"POST",headers:{Cookie:cookies[who],Origin:base,"Content-Type":"application/json"},
   body:JSON.stringify(body),
  }),env);
  const id=crypto.randomUUID(),now=Date.now();
  const win={id,game:"Plinko",wager:1000,payout:10000,at:now};
  assert.equal((await bet("alice",win)).status,201);
  assert.equal((await bet("alice",win)).status,201);
  const messages=db.prepare("SELECT body,kind FROM community_messages").all();
  assert.equal(messages.length,1);
  assert.equal(messages[0].kind,"bigwin");
  assert.match(messages[0].body,/BIG WIN/);
  assert.match(messages[0].body,/player-reported/);
  assert.match(messages[0].body,/10\.00×/);
  assert.equal((await bet("bob",{id:crypto.randomUUID(),game:"Dice",wager:500,payout:0,at:now})).status,201);
  const feed=await worker.fetch(new Request(base+"/api/auth/leaderboard"),env);
  assert.equal(feed.status,200);
  const ranks=await feed.json();
  assert.equal(ranks.leaders.length,1);
  assert.equal(ranks.leaders[0].profitCents,9000);
  assert.equal(ranks.resetAt-ranks.startAt,604800000);
  assert.equal(new Date(ranks.startAt).getUTCDay(),1);
  assert.match(ranks.source,/not independently verified/);
  const c=await worker.fetch(new Request(base+"/api/auth/community",{headers:{Cookie:cookies.bob}}),env);
  assert.equal(c.status,200);
  const board=await c.json();
  assert.equal(board.messages.length,1);
  assert.equal(board.messages[0].kind,"bigwin");
 }finally{db.close();}
});
test("Homepage rotates real stats and leaderboard; Plinko has unbiased bounces; wallet has no decorative plastic card",()=>{
 const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");
 assert.doesNotMatch(source("../src/components/AppShell.tsx"),/<HighlightToast/);
 assert.match(source("../src/pages/HomeSpotlight.tsx"),/Weekly leaderboard/);
 assert.match(source("../src/pages/HomeSpotlight.tsx"),/Your stats/);
 assert.match(source("../src/pages/HomeSpotlight.tsx"),/setInterval/);
 assert.match(source("../src/pages/Lobby.tsx"),/HomeSpotlight history/);
 assert.match(source("../src/games/Plinko.tsx"),/sway/);
 assert.doesNotMatch(source("../src/games/Plinko.tsx"),/luckOn|rights < target/);
 const cashier=source("../src/components/Cashier.tsx");
 assert.doesNotMatch(cashier,/className="plastic"|withdrawToCard|depositFromCard/);
 assert.match(cashier,/\/api\/auth\/demo-voucher/);
});
