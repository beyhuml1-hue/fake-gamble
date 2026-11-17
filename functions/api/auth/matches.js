import { configured, currentUser, hitRateLimit, json, publicDisplayName, readBody, sameOrigin } from "../../_shared/auth.js";
import { newPoolRack, shootPool } from "../../_shared/pool-engine.js";

// Only authenticated players can stake play money. All PvP logic is enforced
// here; the browser never determines match winners or requests match payouts.
import {newUno,playUno,unoView} from "../../_shared/uno-engine.js";
const GAMES = new Set(["pool", "connect-four", "mines-battles", "uno"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WAIT_MS = 15*60_000, TURN_MS = 10*60_000;
const detailSql = "SELECT r.*,h.email AS host_email,g.email AS guest_email FROM pvp_rooms r "+
  "JOIN auth_users h ON h.id=r.host_id LEFT JOIN auth_users g ON g.id=r.guest_id ";

function shuffle25() {
  const values=Array.from({length:25},(_,i)=>i);
  for(let i=24;i>0;i--) {
    const bytes=new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const index=bytes[0]%(i+1);
    [values[i],values[index]]=[values[index],values[i]];
  }
  return values;
}
function initial(game) {
  if(game==="uno")return newUno();
  if(game==="pool")return newPoolRack();
  if(game==="connect-four")return {board:Array(42).fill(0),moves:0};
  return {mines:shuffle25().slice(0,3),revealed:[],hostScore:0,guestScore:0,last:null};
}
function view(row,user) {
  let state=JSON.parse(row.state_json);
  if(row.game==="uno")state=unoView(state,user.id===row.host_id?"host":user.id===row.guest_id?"guest":null);
  // Hidden mines must never be shipped to the opposing browser mid-game.
  if(row.game==="mines-battles" && !["finished","cancelled","expired"].includes(row.status))
    delete state.mines;
  return {
    id:row.id,game:row.game,stakeCents:row.stake_cents,status:row.status,
    host:publicDisplayName(row.host_email),
    guest:row.guest_email?publicDisplayName(row.guest_email):null,
    role:user.id===row.host_id?"host":user.id===row.guest_id?"guest":null,
    myTurn:row.turn_id===user.id&&row.status==="active",
    turn:row.turn_id===row.host_id?"host":row.turn_id===row.guest_id?"guest":null,
    winner:row.winner_id===row.host_id?"host":row.winner_id===row.guest_id?"guest":null,
    result:row.result_text||null,version:row.turn_no,
    createdMs:row.created_ms,updatedMs:row.updated_ms,state
  };
}
async function detail(env,id) {
  return env.DB.prepare(detailSql+"WHERE r.id=?1").bind(id).first();
}
async function expire(env,now) {
  await env.DB.batch([
    env.DB.prepare("UPDATE pvp_rooms SET status='expired',result_text='Waiting room expired; stake refunded.',updated_ms=?1,finished_ms=?1 "+
      "WHERE status='waiting' AND created_ms<?2").bind(now,now-WAIT_MS),
    env.DB.prepare("UPDATE pvp_rooms SET status='expired',winner_id=CASE WHEN turn_id=host_id THEN guest_id ELSE host_id END,"+
      "result_text='Turn timed out; opponent wins.',updated_ms=?1,finished_ms=?1 "+
      "WHERE status='active' AND updated_ms<?2").bind(now,now-TURN_MS)
  ]);
}
function legalMove(row,move) {
  const state=JSON.parse(row.state_json);
  const hostTurn=row.turn_id===row.host_id;
  const other=hostTurn?row.guest_id:row.host_id;
  if(row.game==="uno"){
    const result=playUno(state,hostTurn?"host":"guest",move);if(!result)return null;
    return {state:result.state,next:result.state.turn==="host"?row.host_id:row.guest_id,winner:result.winner?row.turn_id:null,status:result.winner||result.state.draw?"finished":"active",reason:result.winner?"Last card played!":"Card played; automatic draws applied when needed."};
  }
  if(row.game==="pool"){
    if(move?.type!=="shoot")return null;
    const result=shootPool(state,move.x,move.y,move.power);
    if(!result)return null;
    const winner=result.outcome==="win"?row.turn_id:result.outcome==="loss"?other:null;
    return {state:result.state,next:other,winner,
      status:result.outcome==="next"?"active":"finished",
      reason:result.reason+(result.outcome==="draw"?" Match drawn.":"")};
  }
  if(row.game==="connect-four") {
    const col=move?.column;
    if(!Number.isInteger(col)||col<0||col>6 || !Array.isArray(state.board)||state.board.length!==42)return null;
    const board=[...state.board],player=hostTurn?1:2;
    let at=-1;
    for(let y=5;y>=0;y--)if(!board[y*7+col]){at=y*7+col;break;}
    if(at<0)return null;
    board[at]=player;
    const x=at%7,y=Math.floor(at/7);
    const won=[[1,0],[0,1],[1,1],[-1,1]].some(([dx,dy])=>
      [1,2,3].every(d=>{
        const xx=x+dx*d, yy=y+dy*d;
        return xx>=0&&xx<7&&yy>=0&&yy<6&&board[yy*7+xx]===player;
      }) || [1,2,3].every(d=>{
        const xx=x-dx*d, yy=y-dy*d;
        return xx>=0&&xx<7&&yy>=0&&yy<6&&board[yy*7+xx]===player;
      }) || [ -3,-2,-1,0,1,2,3 ].some(start=>
        [0,1,2,3].every(d=>{
          const xx=x+dx*(start+d),yy=y+dy*(start+d);
          return xx>=0&&xx<7&&yy>=0&&yy<6&&board[yy*7+xx]===player;
        })
      ));
    const drawn=board.every(Boolean);
    return {state:{board,moves:state.moves+1},next:other,
      winner:won?row.turn_id:null,status:won||drawn?"finished":"active",
      reason:won?"Connected four.":drawn?"Board full; draw.":"Disc dropped."};
  }
  if(row.game==="mines-battles"){
    const tile=move?.tile;
    if(!Number.isInteger(tile)||tile<0||tile>=25 ||
      !Array.isArray(state.revealed)||state.revealed.includes(tile))return null;
    const revealed=[...state.revealed,tile],hit=state.mines.includes(tile);
    const hostScore=state.hostScore+(!hit&&hostTurn?1:0);
    const guestScore=state.guestScore+(!hit&&!hostTurn?1:0);
    const allSafe=revealed.length===25-state.mines.length;
    const winner=hit?other:allSafe?(hostScore>guestScore?row.host_id:guestScore>hostScore?row.guest_id:null):null;
    return {state:{...state,revealed,hostScore,guestScore,last:tile},next:other,
      winner,status:hit||allSafe?"finished":"active",
      reason:hit?"Mine hit; opponent wins.":allSafe?"All safe tiles opened.":"Safe tile revealed."};
  }
  return null;
}

export async function onRequestGet({request,env}) {
  if(!configured(env))return json({error:"Multiplayer unavailable."},503);
  const user=await currentUser(request,env);
  if(!user)return json({error:"Sign in to browse multiplayer games."},401);
  const url=new URL(request.url),id=url.searchParams.get("id"),game=url.searchParams.get("game");
  if(id!==null&&!UUID.test(id))return json({error:"Invalid match."},400);
  if(game!==null&&!GAMES.has(game))return json({error:"Unknown game."},400);
  try {
    await expire(env,Date.now());
    if(id) {
      const row=await detail(env,id);
      if(!row || (row.host_id!==user.id&&row.guest_id!==user.id))
        return json({error:"Match not found."},404);
      return json({match:view(row,user)});
    }
    const open=await env.DB.prepare(detailSql+"WHERE r.status='waiting' AND (?1 IS NULL OR r.game=?1) "+
      "ORDER BY r.created_ms DESC LIMIT 40").bind(game).all();
    const mine=await env.DB.prepare(detailSql+"WHERE (r.host_id=?1 OR r.guest_id=?1) "+
      "AND r.status IN ('waiting','active') ORDER BY r.created_ms DESC LIMIT 1").bind(user.id).first();
    return json({open:(open.results||[]).map(row=>view(row,user)),mine:mine?view(mine,user):null});
  }catch{return json({error:"Multiplayer rooms temporarily unavailable. Apply migration 0013."},503);}
}
export async function onRequestPost({request,env}) {
  if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
  if(!configured(env))return json({error:"Multiplayer unavailable."},503);
  const user=await currentUser(request,env);
  if(!user)return json({error:"Sign in to play against other players."},401);
  const input=await readBody(request),action=input?.action,now=Date.now();
  if(!["create","join","move","leave"].includes(action))
    return json({error:"Unknown multiplayer action."},400);
  if(!await hitRateLimit(env,"pvp:"+user.id,60_000,60,now))
    return json({error:"Too many actions. Try again shortly."},429);
  try {
    await expire(env,now);
    if(action==="create"){
      const game=input.game,stake=input.stakeCents;
      if(!GAMES.has(game)||!Number.isSafeInteger(stake)||stake<10||stake>1_000_000)
        return json({error:"Choose a game and a stake between $0.10 and $10,000."},400);
      const id=crypto.randomUUID();
      const statement=env.DB.prepare("INSERT INTO pvp_rooms(id,game,host_id,stake_cents,status,state_json,created_ms,updated_ms) "+
        "SELECT ?1,?2,?3,?4,'waiting',?5,?6,?6 FROM playusd_wallets w "+
        "WHERE w.user_id=?3 AND w.initialized=1 AND w.cents>=?4 "+
        "AND NOT EXISTS(SELECT 1 FROM pvp_rooms r WHERE (r.host_id=?3 OR r.guest_id=?3) AND r.status IN ('waiting','active'))");
      const wrote=await statement.bind(id,game,user.id,stake,JSON.stringify(initial(game)),now).run();
      if(wrote.meta?.changes!==1)
        return json({error:"Not enough balance, or you already have an open match."},409);
      return json({match:view(await detail(env,id),user)},201);
    }
    const id=input?.id;
    if(typeof id!=="string"||!UUID.test(id))return json({error:"Invalid match ID."},400);
    if(action==="join"){
      const wrote=await env.DB.prepare("UPDATE pvp_rooms SET guest_id=?1,status='active',turn_id=CASE WHEN game='uno' AND json_extract(state_json,'$.turn')='guest' THEN ?1 ELSE host_id END,updated_ms=?2 "+
        "WHERE id=?3 AND status='waiting' AND guest_id IS NULL AND host_id<>?1 "+
        "AND EXISTS(SELECT 1 FROM playusd_wallets w WHERE w.user_id=?1 AND w.initialized=1 AND w.cents>=pvp_rooms.stake_cents) "+
        "AND NOT EXISTS(SELECT 1 FROM pvp_rooms r WHERE (r.host_id=?1 OR r.guest_id=?1) AND r.status IN ('waiting','active'))")
        .bind(user.id,now,id).run();
      if(wrote.meta?.changes!==1)return json({error:"Room full, unavailable, or insufficient play money."},409);
      return json({match:view(await detail(env,id),user)});
    }
    const row=await detail(env,id);
    if(!row||(row.host_id!==user.id&&row.guest_id!==user.id))
      return json({error:"You are not a player in this match."},403);
    if(action==="leave") {
      if(!["waiting","active"].includes(row.status))return json({error:"Match already closed."},409);
      const waiting=row.status==="waiting",other=row.host_id===user.id?row.guest_id:row.host_id;
      const wrote=await env.DB.prepare("UPDATE pvp_rooms SET status=?1,winner_id=?2,"+
        "result_text=?3,updated_ms=?4,finished_ms=?4 WHERE id=?5 AND status=?6 AND turn_no=?7")
        .bind(waiting?"cancelled":"finished",waiting?null:other,
          waiting?"Waiting game cancelled; stake refunded.":"Opponent forfeited.",now,id,row.status,row.turn_no).run();
      if(wrote.meta?.changes!==1)return json({error:"Match changed; refresh and retry."},409);
      return json({match:view(await detail(env,id),user)});
    }
    if(row.status!=="active"||row.turn_id!==user.id)
      return json({error:"It is not your turn."},409);
    const next=legalMove(row,input.move);
    if(!next)return json({error:"That move is not allowed."},422);
    const done=next.status==="finished";
    const wrote=await env.DB.prepare("UPDATE pvp_rooms SET state_json=?1,turn_id=?2,winner_id=?3,"+
      "status=?4,result_text=?5,updated_ms=?6,finished_ms=?7,turn_no=turn_no+1 "+
      "WHERE id=?8 AND status='active' AND turn_no=?9 AND turn_id=?10")
      .bind(JSON.stringify(next.state),next.next,next.winner,next.status,
        next.reason,now,done?now:null,id,row.turn_no,user.id).run();
    if(wrote.meta?.changes!==1)return json({error:"Move already played; refresh the match."},409);
    return json({match:view(await detail(env,id),user)});
  }catch{
    return json({error:"Multiplayer action unavailable. Check the server and match database."},503);
  }
}

