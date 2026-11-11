import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import worker from "../blockbet-auth.worker.js";
import {issueSession} from "../functions/_shared/auth.js";
test("AI sandbox: owner authorization, mock NanoGPT, private memory and audited rewards",async()=>{
 const db=new DatabaseSync(":memory:"),oldFetch=globalThis.fetch;
 try{
  const dir=new URL("../migrations/",import.meta.url);
  for(const f of readdirSync(dir).sort())db.exec(readFileSync(new URL(f,dir),"utf8"));
  function stmt(sql,args=[]){
   const bind=Object.fromEntries(args.map((v,i)=>[String(i+1),v]));
   return {bind:(...next)=>stmt(sql,next),first:async()=>db.prepare(sql).get(bind),
    all:async()=>({results:db.prepare(sql).all(bind)}),
    run:async()=>({meta:db.prepare(sql).run(bind)}),
    execute:async()=>{const p=db.prepare(sql);return sql.trimStart().startsWith("SELECT")?{results:p.all(bind),meta:{changes:0}}:{results:[],meta:p.run(bind)};}
   };
  }
  const env={AUTH_PEPPER:"only-test",ADMIN_EMAIL:"admin@example.com",NANOGPT_API_KEY:"only-test",
   DB:{prepare:stmt,async batch(stmts){
    db.exec("BEGIN");try{const out=[];for(const s of stmts)out.push(await s.execute());db.exec("COMMIT");return out;}
    catch(e){db.exec("ROLLBACK");throw e;}
   }}};
  const base="https://playblockbet.com",url=base+"/api/auth/ai-owner",cookies={};
  for(const id of ["admin","regular"]){
   const email=id+"@example.com";
   db.prepare("INSERT INTO auth_users(id,email,created_ms,last_login_ms,password_hash) VALUES(?,?,1,1,'test')").run(id,email);
   cookies[id]=(await issueSession(env,{id,email})).headers.get("Set-Cookie").split(";")[0];
  }
  const post=(id,message,origin=base)=>worker.fetch(new Request(url,{
   method:"POST",headers:{Cookie:cookies[id]||"",Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({message})
  }),env);
  assert.equal((await post("regular","hello","https://evil.example")).status,403);
  assert.equal((await post("","hello")).status,401);
  globalThis.fetch=async(_url,options)=>{
   assert.equal(options.headers.Authorization,"Bearer only-test");
   const body=JSON.parse(options.body);
   assert.equal(body.model,"qwen/qwen3.7-flash");
   const result=body.messages.findLast(x=>x.role==="tool");
   if(!result)return new Response(JSON.stringify({choices:[{message:{role:"assistant",content:null,tool_calls:[{
    id:"call1",type:"function",function:{name:"reward_demo_player",arguments:JSON.stringify({player:"player123",coins:3,reason:"test reward"})}
   }]}}]}),{status:200});
   return new Response(JSON.stringify({choices:[{message:{role:"assistant",content:result.content}}]}),{status:200});
  };
  const nonadmin=await post("regular","give player123 3 coins");
  assert.equal(nonadmin.status,200);
  assert.match((await nonadmin.json()).reply,/Owner permission required/);
  assert.equal(db.prepare("SELECT cents FROM ai_demo_players WHERE id='demo-1'").get().cents,25000);
  const admin=await post("admin","give player123 3 coins");
  assert.equal(admin.status,200);
  assert.match((await admin.json()).reply,/"ok":true/);
  assert.equal(db.prepare("SELECT cents FROM ai_demo_players WHERE id='demo-1'").get().cents,25300);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ai_demo_ledger").get().n,1);
  assert.equal(db.prepare("SELECT spent_cents FROM ai_demo_budget").get().spent_cents,300);
  const hist=await worker.fetch(new Request(url,{headers:{Cookie:cookies.admin}}),env);
  assert.equal(hist.status,200);
  assert.deepEqual((await hist.json()).messages.map(x=>x.role),["user","assistant"]);
  const other=await worker.fetch(new Request(url,{headers:{Cookie:cookies.regular}}),env);
  assert.equal((await other.json()).messages.length,2);
 }finally{globalThis.fetch=oldFetch;db.close();}
});
