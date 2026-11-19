import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import worker from "../blockbet-auth.worker.js";
import { issueSession } from "../functions/_shared/auth.js";

function setup(){
  const db=new DatabaseSync(":memory:");
  const dir=new URL("../migrations/",import.meta.url);
  for(const file of readdirSync(dir).filter(f=>f.endsWith(".sql")).sort())
    db.exec(readFileSync(new URL(file,dir),"utf8"));
  function stmt(sql,values=[]){
    const bind=Object.fromEntries(values.map((x,i)=>[String(i+1),x]));
    return {
      bind:(...args)=>stmt(sql,args),
      first:async()=>db.prepare(sql).get(bind),
      all:async()=>({results:db.prepare(sql).all(bind)}),
      run:async()=>({meta:db.prepare(sql).run(bind)}),
      execute:async()=>sql.trimStart().startsWith("SELECT")?
        {results:db.prepare(sql).all(bind),meta:{changes:0}}:
        {results:[],meta:db.prepare(sql).run(bind)}
    };
  }
  const env={AUTH_PEPPER:"pvp-test-secret",DB:{
    prepare:stmt,
    async batch(statements){
      db.exec("BEGIN");
      try{
        const out=[];
        for(const s of statements)out.push(await s.execute());
        db.exec("COMMIT");return out;
      }catch(e){db.exec("ROLLBACK");throw e;}
    }
  }};
  return {db,env};
}

test("Two chess players share legal moves and checkmate settles the stakes once",async()=>{
 const {db,env}=setup();const cookies={};const origin="https://playblockbet.com";
 try{
  for(const id of ["host","guest"]){
   const email=id+"@example.com";
   db.prepare("INSERT INTO auth_users(id,email,created_ms,last_login_ms,password_hash) VALUES(?,?,1,1,'test')").run(id,email);
   cookies[id]=(await issueSession(env,{id,email})).headers.get("Set-Cookie").split(";")[0];
  }
  async function call(id,path,body){const response=await worker.fetch(new Request(origin+"/api/auth/"+path,{method:body?"POST":"GET",headers:{Cookie:cookies[id],Origin:origin,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:response.status,data:await response.json()};}
  for(const id of ["host","guest"])await call(id,"playusd",{action:"initialize"});
  const created=await call("host","matches",{action:"create",game:"chess",stakeCents:1000});assert.equal(created.status,201);
  const id=created.data.match.id;assert.equal((await call("guest","matches?game=chess")).data.open.length,1);
  assert.equal((await call("guest","matches",{action:"join",id})).status,200);
  assert.equal((await call("guest","matches",{action:"move",id,move:{type:"chess",from:"e7",to:"e5"}})).status,409);
  assert.equal((await call("host","matches",{action:"move",id,move:{type:"chess",from:"e2",to:"e5"}})).status,422);
  for(const [player,from,to] of [["host","f2","f3"],["guest","e7","e5"],["host","g2","g4"],["guest","d8","h4"]]){
   const response=await call(player,"matches",{action:"move",id,move:{type:"chess",from,to}});assert.equal(response.status,200,JSON.stringify(response.data));
  }
  const end=(await call("host","matches?id="+id)).data.match;assert.equal(end.status,"finished");assert.equal(end.winner,"guest");assert.equal(end.state.moves.at(-1),"Qh4#");
  assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='guest'").get().cents,101000);
  assert.equal((await call("guest","matches",{action:"leave",id})).status,409);
  assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='guest'").get().cents,101000);
 }finally{db.close();}
});

test("Uno rooms share only each player's hand; Rain donations debit once and pay the full pot",async()=>{
 const {db,env}=setup();const cookies={};const origin="https://playblockbet.com";
 try{
  for(const id of ["host","guest"]){
   const email=id+"@example.com";
   db.prepare("INSERT INTO auth_users(id,email,created_ms,last_login_ms,password_hash) VALUES(?,?,1,1,'test')").run(id,email);
   cookies[id]=(await issueSession(env,{id,email})).headers.get("Set-Cookie").split(";")[0];
  }
  async function call(id,path,body){
   const res=await worker.fetch(new Request(origin+"/api/auth/"+path,{method:body?"POST":"GET",headers:{Cookie:cookies[id],Origin:origin,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})}),env);
   return {status:res.status,data:await res.json()};
  }
  for(const id of ["host","guest"]){
   assert.equal((await call(id,"playusd",{action:"initialize",balance:999999999})).data.balance,100000);
   db.prepare("UPDATE playusd_wallets SET cents=99000 WHERE user_id=?").run(id);
   assert.equal((await call(id,"playusd",{action:"initialize",balance:100000000})).data.balance,99000,"No refill");
  }
  const created=await call("host","matches",{action:"create",game:"uno",stakeCents:100});
  assert.equal(created.status,201);const id=created.data.match.id;
  const listed=await call("guest","matches?game=uno");
  assert.equal(listed.data.open[0].state.hand.length,0);
  const joined=await call("guest","matches",{action:"join",id});assert.equal(joined.status,200);
  assert.equal(joined.data.match.state.hand.length>=7,true);assert.equal(joined.data.match.state.hands,undefined);
  const row=db.prepare("SELECT * FROM pvp_rooms WHERE id=?").get(id);const state=JSON.parse(row.state_json);
  const who=state.turn;const hand=state.hands[who];
  const card=hand.find(c=>c.color!=="wild"&&(c.color===state.color||c.value===state.top.value))||hand.find(c=>c.value==="wild")||hand.find(c=>c.value==="wild4");
  assert.ok(card);
  assert.equal((await call(who,"matches",{action:"move",id,move:{type:"draw"}})).status,422);
  assert.equal((await call(who,"matches",{action:"move",id,move:{type:"play",cardId:card.id,color:"blue"}})).status,200);
  await call("host","matches",{action:"leave",id});
  const board=await call("host","community");const round=board.data.rain.round;
  await call("guest","community",{action:"join",round});
  const before=db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='host'").get().cents;
  const donation={action:"contribute",id:crypto.randomUUID(),round,cents:1200};
  assert.equal((await call("host","community",donation)).status,200);
  assert.equal((await call("host","community",donation)).status,200);
  assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='host'").get().cents,before-1200);
  assert.equal((await call("guest","community")).data.rain.cents,101200);
  assert.equal((await call("host","community",{...donation,id:crypto.randomUUID(),cents:100000000})).status,409);
  db.prepare("UPDATE community_rain SET round=? WHERE round=?").run(round-1,round);
  db.prepare("UPDATE rain_pots SET round=? WHERE round=?").run(round-1,round);
  await call("host","community");await call("guest","community");
  const total=db.prepare("SELECT SUM(delta_cents) AS cents FROM community_wallet_events WHERE kind='rain'").get().cents;
  assert.equal(total,101200);await call("host","community");
  assert.equal(db.prepare("SELECT SUM(delta_cents) AS cents FROM community_wallet_events WHERE kind='rain'").get().cents,2200);
 }finally{db.close();}
});

test("Two players see waiting rooms, escrow their play money and settle exactly once",async()=>{
  const {db,env}=setup();
  const cookies={};
  const origin="https://playblockbet.com";
  try {
    for(const player of ["host","guest"]){
      const email=player+"@example.com";
      db.prepare("INSERT INTO auth_users(id,email,created_ms,last_login_ms,password_hash) VALUES(?,?,1,1,'test')").run(player,email);
      cookies[player]=(await issueSession(env,{id:player,email})).headers.get("Set-Cookie").split(";")[0];
    }
    const call=async(player,path,body)=>{
      const request=new Request(origin+"/api/auth/"+path,{
        method:body?"POST":"GET",
        headers:{Cookie:cookies[player],...(body?{Origin:origin,"Content-Type":"application/json"}:{})},
        ...(body?{body:JSON.stringify(body)}:{})
      });
      const res=await worker.fetch(request,env);
      return {status:res.status,data:await res.json()};
    };
    for(const player of ["host","guest"]){
      assert.equal((await call(player,"playusd",{action:"initialize",balance:10_000})).status,200);
    }
    db.exec("UPDATE playusd_wallets SET cents=10000"); // Existing account fixture.
    assert.equal((await call("host","matches",{action:"create",game:"connect-four",stakeCents:2500})).status,201);
    assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='host'").get().cents,7500);
    const listed=await call("guest","matches?game=connect-four");
    assert.equal(listed.status,200);
    assert.equal(listed.data.open.length,1);
    const roomId=listed.data.open[0].id;
    assert.equal(listed.data.open[0].status,"waiting");
    assert.equal((await call("host","matches",{action:"join",id:roomId})).status,409,"No self joins");
    const joined=await call("guest","matches",{action:"join",id:roomId});
    assert.equal(joined.status,200);
    assert.equal(joined.data.match.status,"active");
    assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='guest'").get().cents,7500);
    assert.equal((await call("guest","matches",{action:"move",id:roomId,move:{column:1}})).status,409,"Cannot play out of turn");
    for(let move=0;move<7;move++){
      const player=move%2?"guest":"host";
      const response=await call(player,"matches",{action:"move",id:roomId,move:{column:move%2?1:0}});
      assert.equal(response.status,200,JSON.stringify(response.data));
      if(move===6){
        assert.equal(response.data.match.status,"finished");
        assert.equal(response.data.match.winner,"host");
      }
    }
    assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='host'").get().cents,12500);
    assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='guest'").get().cents,7500);
    assert.equal((await call("host","matches",{action:"move",id:roomId,move:{column:0}})).status,409);
    assert.equal((await call("guest","matches",{action:"leave",id:roomId})).status,409);
    assert.equal(db.prepare("SELECT cents FROM playusd_wallets WHERE user_id='host'").get().cents,12500);

    const pool=await call("host","matches",{action:"create",game:"pool",stakeCents:500});
    assert.equal(pool.status,201);
    const poolId=pool.data.match.id;
    assert.equal((await call("guest","matches",{action:"join",id:poolId})).status,200);
    assert.equal((await call("host","matches",{action:"move",id:poolId,move:{type:"shoot",x:480,y:175,power:1000}})).status,422);
    const shot=await call("host","matches",{action:"move",id:poolId,move:{type:"shoot",x:480,y:175,power:65}});
    assert.equal(shot.status,200,JSON.stringify(shot.data));
    assert.equal(shot.data.match.state.shots,1);
    assert.equal(shot.data.match.state.balls.length,16);
    const after=await call("guest","matches?"+new URLSearchParams({id:poolId}));
    assert.equal(after.status,200);
    assert.equal(after.data.match.state.shots,1);
    if(shot.data.match.status==="active")
      assert.equal(after.data.match.myTurn,true);
    else assert.equal(after.data.match.status,"finished");

    // A player cannot create another room while in an active match.
    if(shot.data.match.status==="active") {
      const resumed=await call("guest","matches",{action:"create",game:"pool",stakeCents:100});
      assert.equal(resumed.status,200);assert.equal(resumed.data.match.id,poolId);assert.equal(resumed.data.resumed,true);
      assert.equal((await call("guest","matches",{action:"leave",id:poolId})).status,200);
    }
    const mines=await call("host","matches",{action:"create",game:"mines-battles",stakeCents:250});
    assert.equal(mines.status,201,JSON.stringify(mines.data));
    const mineId=mines.data.match.id;
    assert.equal((await call("guest","matches",{action:"join",id:mineId})).status,200);
    const visible=await call("guest","matches?id="+mineId);
    assert.equal(visible.status,200);
    assert.equal(visible.data.match.state.mines,undefined,"Hidden mines cannot leak before play");
    const finished=await call("host","matches",{action:"leave",id:mineId});
    assert.equal(finished.status,200);
    assert.equal(finished.data.match.winner,"guest");

    const waiting=await call("host","matches",{action:"create",game:"pool",stakeCents:100});
    assert.equal(waiting.status,201);
    const cancelled=await call("host","matches",{action:"leave",id:waiting.data.match.id});
    assert.equal(cancelled.status,200);
    assert.equal(cancelled.data.match.status,"cancelled");
  }finally{db.close();}
});

