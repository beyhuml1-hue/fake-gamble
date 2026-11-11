import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import worker from "../blockbet-auth.worker.js";
import {issueSession} from "../functions/_shared/auth.js";

test("The normal Play USD wallet covers game wins, Rain, transfers, and cross-account notifications without a chat reserve",async()=>{
 const db=new DatabaseSync(":memory:");
 try{
  const dir=new URL("../migrations/",import.meta.url);
  for(const file of readdirSync(dir).sort())db.exec(readFileSync(new URL(file,dir),"utf8"));
  const statement=(sql,values=[])=>{
   const bind=Object.fromEntries(values.map((x,i)=>[String(i+1),x]));
   return {bind:(...v)=>statement(sql,v),
    first:async()=>db.prepare(sql).get(bind),
    all:async()=>({results:db.prepare(sql).all(bind)}),
    run:async()=>({meta:db.prepare(sql).run(bind)}),
    execute:async()=>sql.trimStart().startsWith("SELECT")?
       {results:db.prepare(sql).all(bind),meta:{changes:0}}:
       {results:[],meta:db.prepare(sql).run(bind)}
   };
  };
  const env={AUTH_PEPPER:"main-wallet-test",DB:{
   prepare:statement,
   async batch(stmts){
    db.exec("BEGIN");
    try{const result=[];for(const s of stmts)result.push(await s.execute());db.exec("COMMIT");return result;}
    catch(e){db.exec("ROLLBACK");throw e;}
   }
  }};
  const url="https://playblockbet.com",cookies={};
  for(const id of ["alice","bob","charlie"]){
   const email=id+"@example.com";
   db.prepare("INSERT INTO auth_users(id,email,created_ms,last_login_ms,password_hash) VALUES(?,?,1,1,'test')").run(id,email);
   cookies[id]=(await issueSession(env,{id,email})).headers.get("Set-Cookie").split(";")[0];
  }
  const get=(id,path)=>worker.fetch(new Request(url+path,{headers:{Cookie:cookies[id]||""}}),env);
  const post=(id,path,data,origin=url)=>worker.fetch(new Request(url+path,{
   method:"POST",headers:{Cookie:cookies[id]||"",Origin:origin,"Content-Type":"application/json"},
   body:JSON.stringify(data)
  }),env);
  const wallet="/api/auth/playusd",chat="/api/auth/community",notices="/api/auth/wallet-events";
  assert.equal((await get("",wallet)).status,401);
  assert.equal((await post("alice",wallet,{action:"initialize",balance:5000},"https://bad.invalid")).status,403);
  assert.equal((await (await get("alice",wallet)).json()).ready,false);
  assert.equal((await post("alice",wallet,{action:"initialize",balance:5000})).status,200);
  assert.equal((await post("alice",wallet,{action:"initialize",balance:99999})).status,200);
  assert.equal((await (await get("alice",wallet)).json()).balance,5000,"Importing can't reset the main wallet");
  const bets=[
   {id:crypto.randomUUID(),delta:-1200},
   {id:crypto.randomUUID(),delta:4800}
  ];
  for(const op of bets){
   assert.equal((await post("alice",wallet,{action:"game",...op})).status,200);
   assert.equal((await post("alice",wallet,{action:"game",...op})).status,200,"Game ops are idempotent");
  }
  assert.equal((await (await get("alice",wallet)).json()).balance,8600);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM playusd_game_ops").get().n,2);
  assert.equal((await post("alice",wallet,{action:"game",id:crypto.randomUUID(),delta:-8601})).status,409);
  assert.equal((await (await get("alice",wallet)).json()).balance,8600);

  const bobChat=(await (await get("bob",chat)).json());
  const aliceChat=(await (await get("alice",chat)).json());
  // Bob hasn't imported his main balance. His first $30 gift is held safely.
  const first={action:"transfer",id:crypto.randomUUID(),recipient:bobChat.profile.id,cents:3000};
  assert.equal((await post("alice",chat,first)).status,200);
  assert.equal((await post("alice",chat,first)).status,200);
  assert.equal((await (await get("alice",wallet)).json()).balance,5600);
  assert.equal((await (await get("bob",wallet)).json()).ready,false);
  assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='bob'").get().cents,3000);
  assert.equal((await post("bob",wallet,{action:"initialize",balance:2000})).status,200);
  assert.equal((await (await get("bob",wallet)).json()).balance,5000);
  assert.equal((await post("alice",chat,{action:"transfer",id:crypto.randomUUID(),recipient:aliceChat.profile.id,cents:100})).status,409);
  assert.equal((await post("alice",chat,{action:"transfer",id:crypto.randomUUID(),recipient:bobChat.profile.id,cents:6000})).status,409);
  const recv=(await (await get("bob",notices+"?notices=1")).json()).notifications;
  assert.equal(recv.length,1);
  assert.equal(recv[0].cents,3000);
  assert.equal((await post("bob",notices,{action:"dismiss",id:first.id})).status,200);
  assert.equal((await (await get("bob",notices+"?notices=1")).json()).notifications.length,0);

  // Charlie's Rain is awarded to the main account, not the old chat column.
  const charlieChat=(await (await get("charlie",chat)).json());
  const round=charlieChat.rain.round;
  assert.equal((await post("charlie",chat,{action:"join",round})).status,200);
  db.prepare("UPDATE community_rain SET round=?").run(round-1);
  assert.equal((await (await get("charlie",chat)).json()).rain.round,round);
  assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='charlie'").get().cents,1000);
  assert.equal(db.prepare("PRAGMA table_info(community_profiles)").all().some(row=>row.name==="cents"),false);
  assert.equal((await post("charlie",wallet,{action:"initialize",balance:2000})).status,200);
  assert.equal((await (await get("charlie",wallet)).json()).balance,3000);
  assert.equal((await (await get("charlie",chat)).json()).profile.cents,undefined);

  // No duplicate transfers despite retries and social events.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM community_transfers").get().n,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM community_notifications").get().n,1);
 }finally{db.close();}
});

test("Main game wallet frontend submits debits and credits, transfers flush, no client chat reserve",()=>{
 const wallet=readFileSync(new URL("../src/state/wallet.tsx",import.meta.url),"utf8");
 const chat=readFileSync(new URL("../src/pages/Community.tsx",import.meta.url),"utf8");
 assert.match(wallet,/queueDelta\(-cents\)/);
 assert.match(wallet,/queueDelta\(cents\)/);
 assert.match(wallet,/pendingOps/);
 assert.match(wallet,/prepareTransfer/);
 assert.doesNotMatch(chat,/profile\.cents|Only Rain and received-transfer credits/);
 assert.match(chat,/normal Play USD balance/);
});
