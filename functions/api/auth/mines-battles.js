import {configured, currentUser, digest, hitRateLimit, json, readBody, sameOrigin} from "../../_shared/auth.js";

/**
 * BlockBet Mines Battles: free, authenticated, real-user PvP.
 * Each player receives an independent, server-generated 5-mine board.
 * First to reveal 8 safe tiles wins; touching a mine loses immediately.
 * No Play USD is transferred, debited or credited by this endpoint.
 */
const MB_TILES = 25;
const MB_MINES = 5;
const MB_TARGET = 8;
const MB_GAME_MS = 180000;
const MB_WAIT_MS = 600000;
const MB_UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function mbRandomBelow(upper) {
  // Unbiased sampling rather than modulo reduction.
  const buffer = new Uint32Array(1);
  const limit = 4294967296 - (4294967296 % upper);
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % upper;
}
function mbRandomMines() {
  let result = 0;
  while (mbCountBits(result) < MB_MINES) result |= 1 << mbRandomBelow(MB_TILES);
  return result;
}
function mbCountBits(bits) {
  let n=0;
  while (bits) { bits &= bits-1; n++; }
  return n;
}
function mbBoard(mines, shown, over) {
  return Array.from({length: MB_TILES},(_,tile)=>{
    const bit = 1 << tile;
    if (shown & bit) return mines & bit ? "mine" : "gem";
    return over && mines & bit ? "mine-hidden" : "hidden";
  });
}
function mbSummarize(row, viewerId) {
  const done = row.status !== "active" && row.status !== "waiting";
  const active = row.status==="active";
  const isHost = row.host_id===viewerId;
  const isGuest = row.guest_id===viewerId;
  return {
    id:row.id,
    host:row.host_label, guest:row.guest_label,
    viewer:isHost?"host":isGuest?"guest":"spectator",
    status:row.status, winner:row.winner_id===row.host_id?"host":row.winner_id===row.guest_id&&row.guest_id?"guest":null,
    reason:row.end_reason,
    hostScore:row.host_score, guestScore:row.guest_score,
    hostBusted:!!row.host_busted, guestBusted:!!row.guest_busted,
    createdAt:row.created_ms, endsAt:row.ends_ms, startedAt:row.started_ms,
    hostBoard:mbBoard(row.host_mines,row.host_revealed,done),
    guestBoard:row.guest_id ? mbBoard(row.guest_mines,row.guest_revealed,done) : null,
    // A spectator can view revealed tiles but not secret mines until the match ends.
    canPlay:active && (isHost||isGuest),
    canJoin:row.status==="waiting" && !isHost,
  };
}
function mbListRow(row, viewerId) {
  return {
    id:row.id,host:row.host_label,guest:row.guest_label,status:row.status,
    hostScore:row.host_score,guestScore:row.guest_score,
    winner:row.winner_id===row.host_id?"host":row.winner_id===row.guest_id&&row.guest_id?"guest":null,
    createdAt:row.created_ms,endsAt:row.ends_ms,
    viewer:row.host_id===viewerId?"host":row.guest_id===viewerId?"guest":"spectator",
  };
}
const mbError=(message,status=400)=>json({error:message},status,{"Cache-Control":"no-store"});
async function mbExpire(env,now) {
  // Settle without a cron dependency. Score ties remain a draw.
  await env.DB.prepare(
    "UPDATE mines_battle_rooms SET status='finished', end_reason='timeout', finished_ms=?1, " +
    "winner_id=CASE WHEN host_score>guest_score THEN host_id WHEN guest_score>host_score THEN guest_id ELSE NULL END " +
    "WHERE status='active' AND ends_ms<=?1"
  ).bind(now).run();
  await env.DB.prepare(
    "UPDATE mines_battle_rooms SET status='expired', end_reason='unjoined', finished_ms=?1 " +
    "WHERE status='waiting' AND ends_ms<=?1"
  ).bind(now).run();
}
async function mbOne(env,id) {
  return env.DB.prepare("SELECT * FROM mines_battle_rooms WHERE id=?1").bind(id).first();
}
async function mbLabel(env,user) {
  return "Player " + (await digest("mines-battle:"+user.id,env.AUTH_PEPPER)).slice(0,6).toUpperCase();
}
export async function onRequestGet({request,env}) {
  if (!configured(env)) return mbError("Mines Battles are unavailable.",503);
  const user=await currentUser(request,env);
  if (!user) return mbError("Log in to play or spectate Mines Battles.",401);
  try {
    const now=Date.now();
    await mbExpire(env,now);
    const url=new URL(request.url);
    const id=url.searchParams.get("room");
    if (id) {
      if (!MB_UUID.test(id)) return mbError("Invalid battle ID.");
      const row=await mbOne(env,id);
      if (!row) return mbError("That battle doesn't exist.",404);
      return json({room:mbSummarize(row,user.id),serverNow:now},200,{"Cache-Control":"no-store"});
    }
    const result=await env.DB.prepare(
      "SELECT * FROM mines_battle_rooms WHERE created_ms>=?1 AND status IN('waiting','active','finished') " +
      "ORDER BY CASE status WHEN 'waiting' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, created_ms DESC LIMIT 40"
    ).bind(now-24*3600000).all();
    return json({rooms:(result.results||[]).map(row=>mbListRow(row,user.id)),serverNow:now},200,{"Cache-Control":"no-store"});
  }catch(err) {
    console.warn("Mines Battles read failed",err instanceof Error?err.name:"unexpected");
    return mbError("Mines Battles are temporarily unavailable.",503);
  }
}
export async function onRequestPost({request,env}) {
  if(!sameOrigin(request)) return mbError("Invalid request origin.",403);
  if(!configured(env)) return mbError("Mines Battles are unavailable.",503);
  const user=await currentUser(request,env);
  if(!user) return mbError("Sign in to battle other players.",401);
  const input=await readBody(request);
  if(!input||typeof input.action!=="string") return mbError("Invalid battle action.");
  const now=Date.now();
  try{
    if(!await hitRateLimit(env,"mines-battle:"+user.id,60000,50,now))return mbError("Too many actions. Try again shortly.",429);
    await mbExpire(env,now);
    if(input.action==="create") {
      const id=crypto.randomUUID(),mineMask=mbRandomMines(),label=await mbLabel(env,user);
      const insert=await env.DB.prepare(
        "INSERT OR IGNORE INTO mines_battle_rooms(id,host_id,host_label,host_mines,created_ms,ends_ms) " +
        "SELECT ?1,?2,?3,?4,?5,?6 WHERE NOT EXISTS(" +
        "SELECT 1 FROM mines_battle_rooms WHERE (host_id=?2 OR guest_id=?2) AND status IN('waiting','active'))"
      ).bind(id,user.id,label,mineMask,now,now+MB_WAIT_MS).run();
      if(insert.meta?.changes!==1)return mbError("Finish your current battle before making another.",409);
      return json({ok:true,room:mbSummarize(await mbOne(env,id),user.id)},201,{"Cache-Control":"no-store"});
    }
    const id=input.id;
    if(typeof id!=="string"||!MB_UUID.test(id))return mbError("Invalid battle ID.");
    if(input.action==="join"){
      const mineMask=mbRandomMines(),label=await mbLabel(env,user);
      const update=await env.DB.prepare(
        "UPDATE mines_battle_rooms SET guest_id=?1,guest_label=?2,guest_mines=?3,status='active',started_ms=?4,ends_ms=?5 " +
        "WHERE id=?6 AND status='waiting' AND ends_ms>?4 AND host_id<>?1 " +
        "AND NOT EXISTS(SELECT 1 FROM mines_battle_rooms WHERE (host_id=?1 OR guest_id=?1) AND status='active')"
      ).bind(user.id,label,mineMask,now,now+MB_GAME_MS,id).run();
      if(update.meta?.changes!==1)return mbError("This room is unavailable or you're already in a battle.",409);
    }else if(input.action==="cancel"){
      const update=await env.DB.prepare(
        "UPDATE mines_battle_rooms SET status='cancelled',end_reason='cancelled',finished_ms=?1 " +
        "WHERE id=?2 AND host_id=?3 AND status='waiting'"
      ).bind(now,id,user.id).run();
      if(update.meta?.changes!==1)return mbError("Only the room creator can cancel an unjoined battle.",409);
    }else if(input.action==="reveal"){
      const tile=input.tile;
      if(!Number.isInteger(tile)||tile<0||tile>=MB_TILES)return mbError("Choose a valid tile.");
      const bit=1<<tile;
      // D1 batch is transactional. The second SQL statement observes the
      // first and resolves the match before another request can touch it.
      const result=await env.DB.batch([
        env.DB.prepare(
          "UPDATE mines_battle_rooms SET " +
          "host_revealed=CASE WHEN host_id=?1 THEN host_revealed | ?2 ELSE host_revealed END,"+
          "guest_revealed=CASE WHEN guest_id=?1 THEN guest_revealed | ?2 ELSE guest_revealed END,"+
          "host_score=CASE WHEN host_id=?1 AND (host_mines & ?2)=0 THEN host_score+1 ELSE host_score END,"+
          "guest_score=CASE WHEN guest_id=?1 AND (guest_mines & ?2)=0 THEN guest_score+1 ELSE guest_score END,"+
          "host_busted=CASE WHEN host_id=?1 AND (host_mines & ?2)<>0 THEN 1 ELSE host_busted END,"+
          "guest_busted=CASE WHEN guest_id=?1 AND (guest_mines & ?2)<>0 THEN 1 ELSE guest_busted END "+
          "WHERE id=?3 AND status='active' AND ends_ms>?4 AND ("+
          "(host_id=?1 AND (host_revealed & ?2)=0 AND host_busted=0) OR "+
          "(guest_id=?1 AND (guest_revealed & ?2)=0 AND guest_busted=0))"
        ).bind(user.id,bit,id,now),
        env.DB.prepare(
          "UPDATE mines_battle_rooms SET status='finished',finished_ms=?2,"+
          "winner_id=CASE WHEN host_busted=1 THEN guest_id WHEN guest_busted=1 THEN host_id "+
          "WHEN host_score>=?3 THEN host_id WHEN guest_score>=?3 THEN guest_id ELSE NULL END,"+
          "end_reason=CASE WHEN host_busted=1 OR guest_busted=1 THEN 'mine' ELSE 'target' END "+
          "WHERE id=?1 AND status='active' AND (host_busted=1 OR guest_busted=1 OR host_score>=?3 OR guest_score>=?3)"
        ).bind(id,now,MB_TARGET)
      ]);
      if(result[0]?.meta?.changes!==1) return mbError("That tile was already chosen or the battle has ended.",409);
    }else return mbError("Unknown battle action.");
    const row=await mbOne(env,id);
    if(!row)return mbError("Battle not found.",404);
    return json({ok:true,room:mbSummarize(row,user.id)},200,{"Cache-Control":"no-store"});
  }catch(err){
    console.warn("Mines Battles action failed",err instanceof Error?err.name:"unexpected");
    return mbError("Could not complete the battle action. Please retry.",503);
  }
}
