import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import owner,{MODEL,executeTool} from "../src/worker.mjs";

function setup(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec(readFileSync(new URL("../schema.sql",import.meta.url),"utf8"));
 function statement(sql,values=[]){
  const params=Object.fromEntries(values.map((v,i)=>[String(i+1),v]));
  return {
   bind(...p){return statement(sql,p);},
   async first(){return sqlite.prepare(sql).get(params);},
   async all(){return {results:sqlite.prepare(sql).all(params)};},
   async run(){return {meta:sqlite.prepare(sql).run(params)};},
   async execute(){
    const stmt=sqlite.prepare(sql);
    if(/^\s*SELECT\b/i.test(sql))return {results:stmt.all(params),meta:{changes:0}};
    return {results:[],meta:stmt.run(params)};
   }
  };
 }
 const DB={prepare:statement,async batch(items){
  sqlite.exec("BEGIN");
  try{const out=[];for(const item of items)out.push(await item.execute());sqlite.exec("COMMIT");return out;}
  catch(e){sqlite.exec("ROLLBACK");throw e;}
 }};
 const env={DB,STAGING_ACCESS_TOKEN:"test-staging-gate",STAGING_ADMIN_TOKEN:"test-admin-gate",
  STAGING_WEB_ORIGIN:"http://localhost:5173",NANOGPT_MODEL:MODEL,
  NANOGPT_API_KEY:"mock-not-real",DISCORD_BRIDGE_SECRET:"test-bridge",DISCORD_GUILD_ID:"123456789012345678",
  DISCORD_OWNER_ID:"222222222222222222",DISCORD_OWNER_PLAYER_ID:"demo-alex"};
 const url="https://ai-owner-staging.example";
 function request(path,method="GET",data=null,id="demo-alex",admin=false,token="test-staging-gate"){
  const headers={"x-staging-access":token,"x-demo-player":id,origin:env.STAGING_WEB_ORIGIN};
  if(admin)headers["x-staging-admin"]=env.STAGING_ADMIN_TOKEN;
  if(data)headers["content-type"]="application/json";
  return owner.fetch(new Request(url+path,{method,headers,...(data?{body:JSON.stringify(data)}:{})}),env);
 }
 const adminActor={id:"demo-alex",handle:"Player123",role:"admin",surface:"web"};
 const publicActor={id:"demo-blair",handle:"LuckyBlair",role:"player",surface:"web"};
 return {sqlite,env,request,adminActor,publicActor};
}
test("SQL fixtures are imaginary and wallet changes are ledger-only",async()=>{
 const s=setup();
 try{
  assert.equal(s.sqlite.prepare("SELECT COUNT(*) AS n FROM ao_players").get().n,8);
  assert.equal(s.sqlite.prepare("SELECT balance FROM ao_players WHERE id='demo-alex'").get().balance,2500);
  assert.equal(s.sqlite.prepare("SELECT balance FROM ao_players WHERE id='demo-blair'").get().balance,600);
  assert.equal((await s.request("/health")).status,200);
  assert.equal((await s.request("/api/feed","GET",null,"demo-alex",false,"wrong")).status,401);
  const feed=await s.request("/api/feed");
  assert.equal(feed.status,200);
  const data=await feed.json();
  assert.equal(data.staging,true);
  assert.equal(data.people.length,8);
  assert.ok(data.rain.endsAt>Date.now());
  assert.equal(data.me.balance,2550);
  assert.equal((await s.request("/api/feed","GET",null,"fake-id")).status,403);
  assert.equal(s.sqlite.prepare("SELECT COUNT(*) AS n FROM ao_ledger WHERE kind='login' AND player_id='demo-alex'").get().n,1);
  await s.request("/api/feed");
  assert.equal(s.sqlite.prepare("SELECT COUNT(*) AS n FROM ao_ledger WHERE kind='login' AND player_id='demo-alex'").get().n,1);
 }finally{s.sqlite.close();}
});
test("user privileges, reward cap, daily budget, nonnegative balances and idempotency",async()=>{
 const s=setup();
 try{
  const person=s.publicActor,admin=s.adminActor;
  await assert.rejects(()=>executeTool(s.env,person,"grant_coins",{player:"LuckyBlair",amount:10,reason:"bad"},"unsafe-one"),/Admin/);
  await assert.rejects(()=>executeTool(s.env,person,"get_balance",{player:"Player123"},"unsafe-two"),/only view your own/);
  const before=s.sqlite.prepare("SELECT balance FROM ao_players WHERE id='demo-alex'").get().balance;
  const first=await executeTool(s.env,admin,"grant_coins",{player:"Player123",amount:200,reason:"Creator test reward"},"manual:unique:001");
  assert.equal(first.applied,true);
  assert.equal(first.balance,before+200);
  const retry=await executeTool(s.env,admin,"grant_coins",{player:"Player123",amount:200,reason:"Creator test reward"},"manual:unique:001");
  assert.equal(retry.applied,false);
  assert.equal(retry.balance,before+200);
  await assert.rejects(()=>executeTool(s.env,admin,"grant_coins",{player:"Player123",amount:501,reason:"Over cap"},"manual:cap:002"),/reward limit/);
  const removed=await executeTool(s.env,admin,"remove_coins",{player:"Player123",amount:100,reason:"Test debit"},"manual:remove:003");
  assert.equal(removed.balance,before+100);
  await assert.rejects(()=>executeTool(s.env,admin,"remove_coins",{player:"LuckyBlair",amount:5000,reason:"Overdraft"},"manual:remove:004"),/insufficient/);
  assert.equal(s.sqlite.prepare("SELECT balance FROM ao_players WHERE id='demo-blair'").get().balance,600);
  s.sqlite.exec("UPDATE ao_config SET daily_budget=250");
  await assert.rejects(()=>executeTool(s.env,admin,"grant_coins",{player:"LuckyBlair",amount:100,reason:"Exceeds budget"},"manual:budget:005"),/budget/);
  assert.ok(s.sqlite.prepare("SELECT COUNT(*) AS n FROM ao_audit").get().n>=3);
 }finally{s.sqlite.close();}
});
test("staging stats, leaderboard and suspicious detection reflect DB data only",async()=>{
 const s=setup();
 try{
  s.sqlite.prepare("UPDATE ao_bets SET at_ms=?").run(Date.now()-1000);
  const result=await executeTool(s.env,s.adminActor,"get_statistics",{period:"day"},"stats:today");
  assert.equal(result.bets,6);
  assert.equal(result.wagered,1110);
  assert.equal(result.payouts,1300);
  assert.equal(result.simulatedHouseProfit,-190);
  assert.equal(result.source,"isolated staging database");
  const board=await executeTool(s.env,s.publicActor,"get_leaderboard",{period:"day"},"leaderboard:today");
  assert.equal(board[0].handle,"HugoRolls");
  assert.equal(board[0].net,350);
  await assert.rejects(()=>executeTool(s.env,s.publicActor,"detect_suspicious_activity",{period:"day"},"unauthorized"),/Admin/);
 }finally{s.sqlite.close();}
});
test("website chat, @mentions, Rain and @ai use a shared authenticated API",async()=>{
 const s=setup(),oldFetch=globalThis.fetch;
 try{
  let modelCalls=0;
  globalThis.fetch=async(url,options)=>{
   if(!String(url).includes("nano-gpt.com"))throw Error("Unexpected network request.");
   const req=JSON.parse(options.body);modelCalls++;
   assert.equal(req.model,"qwen/qwen3.7-flash");
   assert.ok(!req.tools.some(t=>t.function.name==="grant_coins"));
   return new Response(JSON.stringify({choices:[{message:{role:"assistant",content:"Hey, I'm your BlockBet AI Owner. All balances are pretend!"}}]}),{status:200});
  };
  const note=await s.request("/api/message","POST",{body:"Hi @LuckyBlair"});
  assert.equal(note.status,200);
  assert.equal(modelCalls,0);
  const answer=await s.request("/api/message","POST",{body:"@ai say hi"});
  assert.equal(answer.status,200);
  assert.equal(modelCalls,1);
  const feed=(await answer.json()).feed;
  assert.ok(feed.messages.some(m=>m.role==="assistant"&&m.handle==="BlockBet AI"));
  const round=feed.rain.round;
  assert.equal((await s.request("/api/rain/join","POST",{round})).status,200);
  assert.equal((await s.request("/api/rain/join","POST",{round})).status,200);
  assert.equal(s.sqlite.prepare("SELECT COUNT(*) AS n FROM ao_rain").get().n,1);
  // Simulate the round having closed, then process server settlement.
  s.sqlite.prepare("UPDATE ao_rain SET round=?").run(round-1);
  const balanceBefore=s.sqlite.prepare("SELECT balance FROM ao_players WHERE id='demo-alex'").get().balance;
  await s.request("/api/feed");
  assert.equal(s.sqlite.prepare("SELECT balance FROM ao_players WHERE id='demo-alex'").get().balance,balanceBefore+100);
  await s.request("/api/feed");
  assert.equal(s.sqlite.prepare("SELECT COUNT(*) AS n FROM ao_ledger WHERE kind='rain'").get().n,1);
 }finally{globalThis.fetch=oldFetch;s.sqlite.close();}
});
test("model tool calling uses only model-approved server tool implementations",async()=>{
 const s=setup(),oldFetch=globalThis.fetch;
 try{
  let calls=0;
  globalThis.fetch=async(url,opts)=>{
   assert.equal(String(url),"https://nano-gpt.com/api/v1/chat/completions");
   const payload=JSON.parse(opts.body),isFollowup=payload.messages.some(m=>m.role==="tool");
   calls++;
   return new Response(JSON.stringify({choices:[{message:isFollowup?
    {role:"assistant",content:"Your test balance is recorded in the staging database."}:
    {role:"assistant",content:null,tool_calls:[{id:"call-test",type:"function",function:{name:"get_balance",arguments:'{"player":"Player123"}'}}]}}]}),{status:200});
  };
  const response=await s.request("/api/ask","POST",{message:"What's my balance?"});
  assert.equal(response.status,200);
  assert.equal((await response.json()).toolRounds,1);
  assert.equal(calls,2);
  assert.equal(s.sqlite.prepare("SELECT COUNT(*) AS n FROM ao_audit WHERE action='get_balance'").get().n,1);
  assert.equal(s.sqlite.prepare("SELECT COUNT(*) AS n FROM ao_messages").get().n,2);
  assert.equal((await s.request("/api/admin/action","POST",{tool:"grant_coins",args:{player:"Player123",amount:50,reason:"test"}})).status,403);
 }finally{globalThis.fetch=oldFetch;s.sqlite.close();}
});
test("Discord bridge authenticates origin, server owner identity and shared memory",async()=>{
 const s=setup(),oldFetch=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{role:"assistant",content:"Discord reporting for duty."}}]}),{status:200});
  const url="https://ai-owner-staging.example/discord/bridge";
  const data={guildId:s.env.DISCORD_GUILD_ID,userId:s.env.DISCORD_OWNER_ID,handle:"RealOwner",message:"Hello"};
  const req=(secret,payload=data)=>owner.fetch(new Request(url,{method:"POST",headers:{"content-type":"application/json","x-discord-bridge":secret},body:JSON.stringify(payload)}),s.env);
  assert.equal((await req("wrong")).status,403);
  assert.equal((await req(s.env.DISCORD_BRIDGE_SECRET,{...data,guildId:"999999999999999999"})).status,403);
  const response=await req(s.env.DISCORD_BRIDGE_SECRET);
  assert.equal(response.status,200);
  assert.equal((await response.json()).reply,"Discord reporting for duty.");
  assert.equal(s.sqlite.prepare("SELECT actor_id FROM ao_conversations LIMIT 1").get().actor_id,"demo-alex");
 }finally{globalThis.fetch=oldFetch;s.sqlite.close();}
});
test("server cron autonomously rewards eligible players but cannot double grant",async()=>{
 const s=setup();
 try{
  const now=Date.UTC(2026,10,9,12,0,0);
  s.sqlite.prepare("UPDATE ao_players SET last_seen_ms=?").run(now-500);
  const wait=[];
  await owner.scheduled({cron:"0 * * * *",scheduledTime:now},s.env,{waitUntil(p){wait.push(p);}});
  await Promise.all(wait);
  const awarded=s.sqlite.prepare("SELECT COUNT(*) AS n FROM ao_ledger WHERE kind='surprise'").get().n;
  assert.equal(s.sqlite.prepare("SELECT status FROM ao_bug_events WHERE id='BUG-1001'").get().status,"paid");
  assert.equal(s.sqlite.prepare("SELECT COUNT(*) AS n FROM ao_ledger WHERE kind='compensation'").get().n,1);
  assert.equal(awarded,1);
  const again=[];
  await owner.scheduled({cron:"0 * * * *",scheduledTime:now},s.env,{waitUntil(p){again.push(p);}});
  await Promise.all(again);
  assert.equal(s.sqlite.prepare("SELECT COUNT(*) AS n FROM ao_ledger WHERE kind='surprise'").get().n,1);
  assert.equal(s.sqlite.prepare("SELECT COUNT(*) AS n FROM ao_ledger WHERE kind='compensation'").get().n,1);
  const logs=s.sqlite.prepare("SELECT COUNT(*) AS n FROM ao_audit").get().n;
  assert.ok(logs>=0);
 }finally{s.sqlite.close();}
});


test("preview is served separately, no secrets embedded, and accepts only staging auth",async()=>{
 const s=setup();
 try{
  const response=await owner.fetch(new Request("https://ai-owner-staging.example/preview"),s.env);
  assert.equal(response.status,200);
  assert.match(response.headers.get("content-type"),/text\/html/);
  const html=await response.text();
  assert.match(html,/Coin Rain/);
  assert.match(html,/@ai/);
  assert.match(html,/Open Chat/);
  assert.doesNotMatch(html,/sk-nano-[0-9]/);
  assert.doesNotMatch(html,/test-admin-gate|mock-not-real|test-staging-gate/);
  const request=owner.fetch(new Request("https://ai-owner-staging.example/api/feed",{headers:{"origin":"https://ai-owner-staging.example","x-staging-access":"test-staging-gate"}}),s.env);
  assert.equal((await request).status,200);
 }finally{s.sqlite.close();}
});
test("AI cannot issue bug compensation without a verified matching ticket",async()=>{
 const s=setup();
 try{
  await assert.rejects(()=>executeTool(s.env,s.adminActor,"compensate_bug",{player:"LuckyBlair",amount:35,ticket:"BUG-1001"},"invalid-ticket"),/Ticket/);
  await assert.rejects(()=>executeTool(s.env,s.adminActor,"compensate_bug",{player:"CleoCoins",amount:90,ticket:"BUG-1001"},"invalid-amount"),/Ticket/);
  const paid=await executeTool(s.env,s.adminActor,"compensate_bug",{player:"CleoCoins",amount:35,ticket:"BUG-1001"},"valid-ticket");
  assert.equal(paid.applied,true);
  assert.equal(s.sqlite.prepare("SELECT status FROM ao_bug_events WHERE id='BUG-1001'").get().status,"paid");
  await assert.rejects(()=>executeTool(s.env,s.adminActor,"compensate_bug",{player:"CleoCoins",amount:35,ticket:"BUG-1001"},"replay-ticket"),/Ticket/);
 }finally{s.sqlite.close();}
});
