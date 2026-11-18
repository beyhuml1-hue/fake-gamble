import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import worker from "../blockbet-auth.worker.js";
import {issueSession} from "../functions/_shared/auth.js";

test("Owner controls require two credentials and update account state, wallet, presence and reset/delete",async()=>{
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
    execute:async()=>/^(SELECT|PRAGMA)/i.test(sql.trimStart())?
     {results:db.prepare(sql).all(bind),meta:{changes:0}}:
     {results:[],meta:db.prepare(sql).run(bind)}
   };
  };
  const env={AUTH_PEPPER:"test-pepper",ADMIN_EMAIL:"owner@example.com",ADMIN_PANEL_PASSWORD:"local-test-password",DB:{
   prepare:statement,
   async batch(rows){db.exec("BEGIN");try{const out=[];for(const row of rows)out.push(await row.execute());db.exec("COMMIT");return out;}
    catch(e){db.exec("ROLLBACK");throw e;}}
  }};
  const cookies={};
  for(const name of ["owner","alice","bob"]){
   const email=name+"@example.com";
   db.prepare("INSERT INTO auth_users(id,email,created_ms,last_login_ms,password_hash) VALUES(?,?,1,1,'test')").run(name,email);
   db.prepare("INSERT INTO playusd_wallets(user_id,cents,initialized,updated_ms) VALUES(?,100000,1,1)").run(name);
   cookies[name]=(await issueSession(env,{id:name,email})).headers.get("Set-Cookie").split(";")[0];
  }
  const base="https://playblockbet.com";
  const call=(who,path,body,adminPassword)=>worker.fetch(new Request(base+path,{
   method:body?"POST":"GET",
   headers:{Cookie:cookies[who]||"",...(adminPassword?{"X-Blockbet-Admin-Key":adminPassword}:{}),...(body?{Origin:base,"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  const ownerKey=env.ADMIN_PANEL_PASSWORD,account="alice@example.com";
  assert.equal((await call("bob","/api/auth/admin?list=1",null,ownerKey)).status,403);
  assert.equal((await call("owner","/api/auth/admin?list=1",null,"wrong")).status,401);
  const first=await call("owner","/api/auth/admin?list=1",null,ownerKey);
  assert.equal(first.status,200);
  const list=await first.json();
  assert.equal(list.accounts.length,3);
  assert.match(list.demoCard.number,/^BB-DEMO-/);
  const post=async(action,other={})=>call("owner","/api/auth/admin",{email:account,action,...other},ownerKey);
  assert.equal((await post("balance",{cents:25000000})).status,200);
  assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='alice'").get().cents,25000000);
  assert.equal((await post("luck",{mode:"hot"})).status,200);
  assert.equal((await post("bomb",{tile:6})).status,200);
  const session=await (await call("alice","/api/auth/me")).json();
  assert.equal(session.user.luckMode,"hot");
  assert.equal(session.user.bombTile,6);
  assert.equal((await post("pause")).status,200);
  assert.equal((await call("alice","/api/auth/playusd")).status,401);
  assert.equal((await (await call("alice","/api/auth/account-status")).json()).status,"paused");
  assert.equal((await post("unpause")).status,200);
  assert.equal((await post("reset",{confirm:account})).status,200);
  assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='alice'").get().cents,100000);
  assert.equal((await (await call("alice","/api/auth/me")).json()).user.balanceAdjustment.mode,"reset");
  assert.equal((await post("ban")).status,200);
  assert.equal((await (await call("alice","/api/auth/account-status")).json()).status,"banned");
  assert.equal((await post("unban")).status,200);
  assert.equal((await post("delete",{confirm:"wrong@example.com"})).status,400);
  const deletion=await post("delete",{confirm:account});
  assert.equal(deletion.status,200,await deletion.text());
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auth_users WHERE email=?").get(account).n,0);
 }finally{db.close();}
});
