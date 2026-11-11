import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import worker from "../blockbet-auth.worker.js";
import {issueSession} from "../functions/_shared/auth.js";

test("Rain and transfers issue idempotent normal-wallet events, notify recipients and publish player stats",async()=>{
 const db=new DatabaseSync(":memory:");
 try{
  const dir=new URL("../migrations/",import.meta.url);
  for(const file of readdirSync(dir).sort()) db.exec(readFileSync(new URL(file,dir),"utf8"));
  function statement(sql,values=[]){
   const valuesByIndex=Object.fromEntries(values.map((v,i)=>[String(i+1),v]));
   return {bind:(...v)=>statement(sql,v),
    first:async()=>db.prepare(sql).get(valuesByIndex),
    all:async()=>({results:db.prepare(sql).all(valuesByIndex)}),
    run:async()=>({meta:db.prepare(sql).run(valuesByIndex)}),
    execute:async()=>{
      const prepared=db.prepare(sql);
      return sql.trimStart().startsWith("SELECT")
       ? {results:prepared.all(valuesByIndex),meta:{changes:0}}
       : {results:[],meta:prepared.run(valuesByIndex)};
    }
   };
  }
  const env={AUTH_PEPPER:"wallet-test",DB:{prepare:statement,
   async batch(statements){
    db.exec("BEGIN");
    try{const out=[];for(const s of statements)out.push(await s.execute());db.exec("COMMIT");return out;}
    catch(err){db.exec("ROLLBACK");throw err;}
   }}};
  const root="https://playblockbet.com";
  const chat=root+"/api/auth/community",wallet=root+"/api/auth/wallet-events";
  const accounts=["alice","bob","cam"],cookies={};
  for(const id of accounts){
   const email=id+"@example.com";
   db.prepare("INSERT INTO auth_users(id,email,created_ms,last_login_ms,password_hash) VALUES(?,?,1,1,'test')").run(id,email);
   cookies[id]=(await issueSession(env,{id,email})).headers.get("Set-Cookie").split(";")[0];
  }
  const get=(id,url)=>worker.fetch(new Request(url,{headers:{Cookie:cookies[id]||""}}),env);
  const post=(id,url,payload,origin=root)=>worker.fetch(new Request(url,{method:"POST",headers:{
   Cookie:cookies[id]||"",Origin:origin,"Content-Type":"application/json"
  },body:JSON.stringify(payload)}),env);
  assert.equal((await get("",wallet)).status,401);
  assert.equal((await post("alice",wallet,{action:"dismiss",id:crypto.randomUUID()},"https://evil.test")).status,403);
  const initial=await Promise.all(accounts.map(async name=>(await (await get(name,chat)).json())));
  const round=initial[0].rain.round;
  assert.equal((await (await get("alice",chat)).json()).players.length,3);
  assert.equal((await post("alice",chat,{action:"message",body:"hello everyone"})).status,201);
  assert.equal((await post("cam",chat,{action:"message",body:"hello alice"})).status,201);
  const publicChat=(await (await get("bob",chat)).json());
  assert.equal(publicChat.messages.length,2);
  assert.doesNotMatch(JSON.stringify(publicChat.messages),/@example\.com/);

  // Public profile reports observed bet submissions without leaking email/private data.
  const now=Date.now();
  db.prepare("INSERT INTO auth_live_bets(id,user_id,label,game,wager,payout,at_ms) VALUES(?,'alice','Player Alice','Dice',100,300,?)").run(crypto.randomUUID(),now);
  db.prepare("INSERT INTO auth_live_bets(id,user_id,label,game,wager,payout,at_ms) VALUES(?,'alice','Player Alice','Dice',100,0,?)").run(crypto.randomUUID(),now+1);
  const profileResponse=await get("bob",chat+"?player="+initial[0].profile.id);
  assert.equal(profileResponse.status,200);
  const profile=await profileResponse.json();
  assert.deepEqual({bets:profile.stats.bets,wagered:profile.stats.wageredCents,won:profile.stats.wonCents,lost:profile.stats.lostCents,net:profile.stats.netCents},
   {bets:2,wagered:200,won:200,lost:100,net:100});
  assert.doesNotMatch(JSON.stringify(profile),/@example\.com/);

  for(const name of accounts)assert.equal((await post(name,chat,{action:"join",round})).status,200);
  assert.equal((await post("alice",chat,{action:"join",round})).status,200);
  db.prepare("UPDATE community_rain SET round=?").run(round-1);
  const payout=await Promise.all(accounts.map(async name=>(await (await get(name,wallet+"?after=0")).json())));
  assert.deepEqual(payout.map(x=>x.events.reduce((sum,e)=>sum+e.delta,0)),[334,333,333]);
  assert.deepEqual(payout.map(x=>x.events[0].kind),["rain","rain","rain"]);
  assert.equal(payout.flatMap(x=>x.events).reduce((s,e)=>s+e.delta,0),1000);
  const balanceBefore=db.prepare("SELECT cents FROM community_profiles WHERE user_id='alice'").get().cents;
  assert.equal(balanceBefore,334);
  const eventCountBefore=db.prepare("SELECT COUNT(*) AS n FROM community_wallet_events").get().n;
  assert.equal((await (await get("alice",wallet+"?after=0")).json()).events.length,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM community_wallet_events").get().n,eventCountBefore);

  const transferId=crypto.randomUUID();
  const transfer={action:"transfer",id:transferId,recipient:initial[1].profile.id,cents:200};
  assert.equal((await post("alice",chat,transfer)).status,200);
  assert.equal((await post("alice",chat,transfer)).status,200);
  assert.equal((await post("alice",chat,{...transfer,id:crypto.randomUUID(),cents:900})).status,409);
  const aliceEvents=(await (await get("alice",wallet+"?after=0")).json()).events;
  const bobSync=(await (await get("bob",wallet+"?after=0")).json());
  assert.deepEqual(aliceEvents.map(x=>x.delta),[334,-200]);
  assert.deepEqual(bobSync.events.map(x=>x.delta),[333,200]);
  assert.equal(bobSync.notifications.length,1);
  assert.equal(bobSync.notifications[0].cents,200);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM community_transfers").get().n,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM community_notifications").get().n,1);
  assert.equal(db.prepare("SELECT cents FROM community_profiles WHERE user_id='alice'").get().cents,134);
  assert.equal(db.prepare("SELECT cents FROM community_profiles WHERE user_id='bob'").get().cents,533);

  const endCursor=bobSync.events.at(-1).seq;
  assert.deepEqual((await (await get("bob",wallet+"?after="+endCursor)).json()).events,[]);
  assert.equal((await post("bob",wallet,{action:"dismiss",id:transferId})).status,200);
  assert.deepEqual((await (await get("bob",wallet+"?after="+endCursor)).json()).notifications,[]);
  // Other players cannot mark recipient's alerts as read.
  assert.equal((await post("alice",wallet,{action:"dismiss",id:transferId})).status,200);
 }finally{db.close();}
});

test("UI pulls server credits into normal wallet and Mines Battles is fully unlinked",()=>{
 const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
 const shell=readFileSync(new URL("../src/components/AppShell.tsx",import.meta.url),"utf8");
 const wallet=readFileSync(new URL("../src/state/wallet.tsx",import.meta.url),"utf8");
 const chat=readFileSync(new URL("../src/pages/Community.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(app,/MinesBattles|path="mines-battles"/);
 assert.doesNotMatch(shell,/to="\/mines-battles"/);
 assert.match(wallet,/blockbet:wallet-sync/);
 assert.match(wallet,/socialCursor/);
 assert.match(shell,/notifications\.map/);
 assert.match(chat,/chat-profile-stats/);
 assert.match(chat,/Available to send/);
});
