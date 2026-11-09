import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import worker from "../blockbet-auth.worker.js";
import {issueSession} from "../functions/_shared/auth.js";

test("real-player Mines Battles enforce server tiles, privacy, fair finish and timeouts", async()=>{
 const db=new DatabaseSync(":memory:");
 try{
  const dir=new URL("../migrations/",import.meta.url);
  for(const file of readdirSync(dir).sort())db.exec(readFileSync(new URL(file,dir),"utf8"));
  function statement(sql,values=[]){
   const bound=Object.fromEntries(values.map((v,i)=>[String(i+1),v]));
   return {
    bind:(...next)=>statement(sql,next),
    first:async()=>db.prepare(sql).get(bound),
    run:async()=>({meta:db.prepare(sql).run(bound)}),
    execute:async()=>{
     const p=db.prepare(sql);
     if(sql.trimStart().startsWith("SELECT"))return {results:p.all(bound),meta:{changes:0}};
     return {results:[],meta:p.run(bound)};
    }
   };
  }
  const env={AUTH_PEPPER:"only-for-mines-tests",DB:{
   prepare:statement,
   async batch(actions){
    db.exec("BEGIN");
    try{const done=[];for(const item of actions)done.push(await item.execute());db.exec("COMMIT");return done;}
    catch(e){db.exec("ROLLBACK");throw e;}
   }
  }};
  const base="https://playblockbet.com";
  const url=base+"/api/auth/mines-battles";
  const users=["alice","bob","cam"];
  const cookies=[];
  for(const id of users){
   const email=id+"@example.com";
   db.prepare("INSERT INTO auth_users(id,email,created_ms,last_login_ms,password_hash) VALUES(?,?,1,1,'test')").run(id,email);
   const response=await issueSession(env,{id,email});
   assert.equal(response.status,200);
   cookies.push(response.headers.get("Set-Cookie").split(";")[0]);
  }
  const get=(cookie="",room="")=>worker.fetch(new Request(url+(room?"?room="+room:""),{headers:{Cookie:cookie}}),env);
  const post=(cookie,data,origin=base)=>worker.fetch(new Request(url,{
   method:"POST",headers:{Cookie:cookie,Origin:origin,"Content-Type":"application/json"},
   body:JSON.stringify(data)
  }),env);
  assert.equal((await get()).status,401);
  assert.equal((await post(cookies[0],{action:"create"},base+"/other")).status,403);
  const createdResponse=await post(cookies[0],{action:"create"});
  assert.equal(createdResponse.status,201);
  let room=(await createdResponse.json()).room;
  assert.match(room.id,/^[a-f0-9-]{36}$/);
  assert.equal(room.status,"waiting");
  assert.equal(room.guestBoard,null);
  assert.deepEqual(new Set(room.hostBoard),new Set(["hidden"]));
  assert.doesNotMatch(JSON.stringify(room),/@example\.com|host_mines|guest_mines/);
  assert.equal((await post(cookies[0],{action:"create"})).status,409);
  assert.equal((await post(cookies[0],{action:"join",id:room.id})).status,409);
  const join=await post(cookies[1],{action:"join",id:room.id});
  assert.equal(join.status,200);
  room=(await join.json()).room;
  assert.equal(room.status,"active");
  assert.equal(room.viewer,"guest");
  assert.equal(room.canPlay,true);
  assert.equal((await post(cookies[2],{action:"join",id:room.id})).status,409);
  assert.equal((await post(cookies[2],{action:"reveal",id:room.id,tile:0})).status,409);
  const spectator=(await (await get(cookies[2],room.id)).json()).room;
  assert.equal(spectator.viewer,"spectator");
  assert.equal(spectator.canPlay,false);
  assert.equal(spectator.guestBoard.filter(v=>v==="hidden").length,25);
  // Only the test server may inspect hidden positions. Browser API cannot.
  const stored=db.prepare("SELECT guest_mines FROM mines_battle_rooms WHERE id=?").get(room.id);
  const safe=Array.from({length:25},(_,i)=>i).filter(i=>(stored.guest_mines&(1<<i))===0);
  const first=await post(cookies[1],{action:"reveal",id:room.id,tile:safe[0]});
  assert.equal(first.status,200);
  room=(await first.json()).room;
  assert.equal(room.guestScore,1);
  assert.equal(room.guestBoard[safe[0]],"gem");
  assert.equal(room.guestBoard.filter(v=>v==="hidden").length,24);
  assert.equal((await post(cookies[1],{action:"reveal",id:room.id,tile:safe[0]})).status,409);
  for(const tile of safe.slice(1,8)){
    const move=await post(cookies[1],{action:"reveal",id:room.id,tile});
    assert.equal(move.status,200);
    room=(await move.json()).room;
  }
  assert.equal(room.guestScore,8);
  assert.equal(room.status,"finished");
  assert.equal(room.winner,"guest");
  assert.equal(room.reason,"target");
  assert.equal(room.hostBoard.filter(v=>v==="mine-hidden").length,5);
  assert.equal((await post(cookies[0],{action:"reveal",id:room.id,tile:0})).status,409);
  // New game: choosing a mine immediately makes the opponent the winner.
  const next=(await (await post(cookies[0],{action:"create"})).json()).room;
  assert.equal((await post(cookies[2],{action:"join",id:next.id})).status,200);
  const hostMines=db.prepare("SELECT host_mines FROM mines_battle_rooms WHERE id=?").get(next.id).host_mines;
  const mine=Array.from({length:25},(_,i)=>i).find(i=>(hostMines&(1<<i))!==0);
  const exploded=await post(cookies[0],{action:"reveal",id:next.id,tile:mine});
  assert.equal(exploded.status,200);
  const explodedRoom=(await exploded.json()).room;
  assert.equal(explodedRoom.status,"finished");
  assert.equal(explodedRoom.reason,"mine");
  assert.equal(explodedRoom.winner,"guest");
  // Empty room can only be cancelled by its creator.
  const empty=(await (await post(cookies[0],{action:"create"})).json()).room;
  assert.equal((await post(cookies[1],{action:"cancel",id:empty.id})).status,409);
  assert.equal((await post(cookies[0],{action:"cancel",id:empty.id})).status,200);
  // Timer does not manufacture winners; equal scores settle as a draw.
  const late=(await (await post(cookies[0],{action:"create"})).json()).room;
  assert.equal((await post(cookies[2],{action:"join",id:late.id})).status,200);
  db.prepare("UPDATE mines_battle_rooms SET ends_ms=? WHERE id=?").run(Date.now()-1,late.id);
  const after=(await (await get(cookies[0],late.id)).json()).room;
  assert.equal(after.status,"finished");
  assert.equal(after.winner,null);
  assert.equal(after.reason,"timeout");
  assert.equal((await post(cookies[0],{action:"reveal",id:late.id,tile:0})).status,409);
 }finally{db.close();}
});

test("Mines Battles stays separate from Club and Play USD wallet",()=>{
 const src=readFileSync(new URL("../functions/api/auth/mines-battles.js",import.meta.url),"utf8");
 const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
 const game=readFileSync(new URL("../src/games/Mines.tsx",import.meta.url),"utf8");
 assert.match(src,/crypto\.getRandomValues/);
 assert.match(src,/currentUser\(request,env\)/);
 assert.match(src,/sameOrigin\(request\)/);
 assert.match(src,/hitRateLimit/);
 assert.doesNotMatch(src,/club_|community_transfers|balance_cents|credit\(|debit\(/);
 assert.match(app,/path="mines-battles" element=\{<MinesBattles \/>/);
 assert.match(game,/to="\/mines-battles"/);
 assert.doesNotMatch(app,/path="club"/);
});
