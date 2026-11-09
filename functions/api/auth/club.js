import { configured, currentUser, digest, hitRateLimit, json, readBody, sameOrigin } from "../../_shared/auth.js";

// BlockBet Club is a separate, server-managed, fictional-points game layer.
// Club Points cannot be exchanged for casino Play USD or real-world value.
const CLUB_ROUND_MS = 120000;
const PACK_COST = 80;
const CLUB_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AVATARS = ["🪙","🦊","🐲","👑","💎","⚡","🐼","🚀","🎮","🌙","🔥","🦁"];
const BANNERS = ["emerald","midnight","royal","sunset","ocean"];
const PRIZES = [
  {id:"mint-coin",name:"Mint Coin",tier:"Common",weight:42},
  {id:"storm-dice",name:"Storm Dice",tier:"Common",weight:28},
  {id:"steel-frame",name:"Steel Frame",tier:"Uncommon",weight:16},
  {id:"aurora-banner",name:"Aurora Banner",tier:"Uncommon",weight:9},
  {id:"gold-coin",name:"Gold Coin",tier:"Rare",weight:4},
  {id:"crown-frame",name:"Crown Frame",tier:"Legendary",weight:1},
  {id:"champion-frame",name:"Weekend Champion Frame",tier:"Tournament",weight:0},
];
const MISSIONS = [
  {id:"pack",name:"Open a cosmetic pack",kind:"pack"},
  {id:"duel",name:"Join a coinflip battle",kind:"duel"},
  {id:"jackpot",name:"Join the community jackpot",kind:"jackpot"},
];
function dayKey(now) { return new Date(now).toISOString().slice(0,10); }
function monday(now) {
  const d=new Date(now);
  const w=(d.getUTCDay()+6)%7;
  return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-w)).toISOString().slice(0,10);
}
function weekend(now) { const d=new Date(now).getUTCDay(); return d===0 || d===6; }
function randomInt(n) {
  const a=new Uint32Array(1), bound=0x100000000-(0x100000000 % n);
  do { crypto.getRandomValues(a); } while(a[0]>=bound);
  return a[0] % n;
}
const safe = (name) => typeof name==="string" && /^[\p{L}\p{N}_ ]{3,18}$/u.test(name) && name.trim().length>=3;
function bad(error,status=400){return json({error},status);}
async function first(env,sql,...args){ return env.DB.prepare(sql).bind(...args).first(); }
async function all(env,sql,...args){const res=await env.DB.prepare(sql).bind(...args).all();return res.results||[];}
async function ensure(env,user,now) {
  const existing=await first(env,"SELECT user_id FROM club_players WHERE user_id=?1",user.id);
  if(existing)return;
  const label="Player "+(await digest("club:"+user.id,env.AUTH_PEPPER)).slice(0,6).toUpperCase();
  await env.DB.prepare("INSERT OR IGNORE INTO club_players(user_id,public_id,handle,created_ms) VALUES(?1,?2,?3,?4)")
    .bind(user.id,crypto.randomUUID(),label,now).run();
}
async function award(env,ref,userId,kind,xp,now){
 await env.DB.prepare("INSERT OR IGNORE INTO club_xp_events(ref,user_id,kind,xp,at_ms) VALUES(?1,?2,?3,?4,?5)")
 .bind(ref,userId,kind,xp,now).run();
}
async function points(env,ref,userId,amount,now){
 await env.DB.prepare("INSERT OR IGNORE INTO club_points_ledger(ref,user_id,delta,created_ms) VALUES(?1,?2,?3,?4)")
 .bind(ref,userId,amount,now).run();
}
async function refundExpiredDuels(env,now){
 // Abandoned open challenges expire after ten minutes, returning the stake.
 const expired=await all(env,"SELECT id,maker FROM club_duels WHERE joiner IS NULL AND expires_ms<?1 LIMIT 30",now);
 for(const duel of expired){
   await env.DB.batch([
     env.DB.prepare("INSERT OR IGNORE INTO club_points_ledger(ref,user_id,delta,created_ms) SELECT ?1,maker,stake,?3 FROM club_duels WHERE id=?2 AND joiner IS NULL").bind("duel:refund:"+duel.id,duel.id,now),
     env.DB.prepare("DELETE FROM club_duels WHERE id=?1 AND joiner IS NULL AND expires_ms<?2").bind(duel.id,now),
   ]);
 }
}
async function settleJackpot(env,round,now){
  if(round<0)return;
  const existing=await first(env,"SELECT winner_id FROM club_jackpot_winners WHERE round=?1",round);
  if(existing)return;
  const entries=await all(env,"SELECT user_id, stake FROM club_jackpot_entries WHERE round=?1 ORDER BY user_id",round);
  const pot=entries.reduce((sum,e)=>sum+e.stake,0);
  if(!pot)return;
  let ticket=randomInt(pot),winner=entries[0].user_id;
  for(const row of entries){ticket-=row.stake;if(ticket<0){winner=row.user_id;break;}}
  await env.DB.prepare("INSERT OR IGNORE INTO club_jackpot_winners(round,winner_id,pot,settled_ms) VALUES(?1,?2,?3,?4)")
    .bind(round,winner,pot,now).run();
  // Payout references are unique; parallel requests cannot pay twice.
  await env.DB.prepare("INSERT OR IGNORE INTO club_points_ledger(ref,user_id,delta,created_ms) SELECT ?1,winner_id,pot,?3 FROM club_jackpot_winners WHERE round=?2")
    .bind("jackpot:win:"+round,round,now).run();
  await env.DB.prepare("INSERT OR IGNORE INTO club_xp_events(ref,user_id,kind,xp,at_ms) SELECT ?1,winner_id,'jackpot-win',40,?3 FROM club_jackpot_winners WHERE round=?2")
    .bind("xp:jackpot:win:"+round,round,now).run();
}
async function awardChampion(env,now) {
 const week=monday(now-7*86400000);
 const start=Date.parse(week+"T00:00:00Z"), end=start+7*86400000;
 const top=await first(env,
 "SELECT t.user_id,COALESCE(SUM(CASE e.kind WHEN 'duel-win' THEN 3 WHEN 'jackpot-win' THEN 5 ELSE 0 END),0) AS score " +
 "FROM club_tournament_entries t LEFT JOIN club_xp_events e ON e.user_id=t.user_id AND e.at_ms>=t.joined_ms AND e.at_ms<?2 AND e.kind IN ('duel-win','jackpot-win') " +
 "WHERE t.week=?1 GROUP BY t.user_id ORDER BY score DESC,t.joined_ms LIMIT 1",week,end);
 if(top && top.score>0){
  await env.DB.prepare("INSERT OR IGNORE INTO club_inventory(user_id,item,acquired_ms) VALUES(?1,'champion-frame',?2)").bind(top.user_id,now).run();
 }
}
async function publicState(env,user,now) {
 const day=dayKey(now), week=monday(now), round=Math.floor(now/CLUB_ROUND_MS);
 await refundExpiredDuels(env,now);
 await settleJackpot(env,round-1,now);
 const [
  profile,people,boardWeek,boardDay,inventory,duels,jackpot,prevJackpot,
  friends,party,packHistory,dayEvents,tournament,standings,partyMembers,
 ]=await Promise.all([
  first(env,"SELECT public_id AS id,handle,avatar,banner,xp,points,equip FROM club_players WHERE user_id=?1",user.id),
  all(env,"SELECT public_id AS id,handle,avatar,banner,xp,CASE WHEN last_seen_ms>?1 THEN 1 ELSE 0 END AS online FROM club_players ORDER BY xp DESC LIMIT 36",now-90000),
  all(env,"SELECT p.public_id AS id,p.handle,p.avatar,SUM(e.xp) AS score FROM club_xp_events e JOIN club_players p ON p.user_id=e.user_id WHERE e.at_ms>=?1 GROUP BY e.user_id ORDER BY score DESC LIMIT 20",now-7*86400000),
  all(env,"SELECT p.public_id AS id,p.handle,p.avatar,SUM(e.xp) AS score FROM club_xp_events e JOIN club_players p ON p.user_id=e.user_id WHERE e.at_ms>=?1 GROUP BY e.user_id ORDER BY score DESC LIMIT 20",Date.parse(day+"T00:00:00Z")),
  all(env,"SELECT item FROM club_inventory WHERE user_id=?1 ORDER BY acquired_ms DESC",user.id),
  all(env,"SELECT d.id,d.stake,d.maker_side AS side,d.outcome,d.created_ms AS at,d.expires_ms AS expiresAt, a.public_id AS makerId,a.handle AS maker,a.avatar AS makerAvatar,b.public_id AS joinerId,b.handle AS joiner, w.public_id AS winnerId FROM club_duels d JOIN club_players a ON a.user_id=d.maker LEFT JOIN club_players b ON b.user_id=d.joiner LEFT JOIN club_players w ON w.user_id=d.winner_id WHERE d.created_ms>?1 ORDER BY d.created_ms DESC LIMIT 25",now-24*3600000),
  all(env,"SELECT p.public_id AS id,p.handle,p.avatar,j.stake FROM club_jackpot_entries j JOIN club_players p ON p.user_id=j.user_id WHERE j.round=?1 ORDER BY j.joined_ms",round),
  first(env,"SELECT p.handle AS winner,w.pot,w.round FROM club_jackpot_winners w JOIN club_players p ON p.user_id=w.winner_id WHERE w.round=?1",round-1),
  all(env,"SELECT p.public_id AS id,p.handle,p.avatar,CASE WHEN p.last_seen_ms>?2 THEN 1 ELSE 0 END AS online,f.accepted,f.requested_by AS requester FROM club_friends f JOIN club_players p ON p.user_id=CASE WHEN f.user_lo=?1 THEN f.user_hi ELSE f.user_lo END WHERE f.user_lo=?1 OR f.user_hi=?1",user.id,now-90000),
  first(env,"SELECT p.code,p.expires_ms AS expiresAt,o.handle AS owner FROM club_parties p JOIN club_players o ON o.user_id=p.owner_id JOIN club_party_members m ON m.code=p.code WHERE m.user_id=?1 AND p.expires_ms>?2 ORDER BY p.created_ms DESC LIMIT 1",user.id,now),
  all(env,"SELECT item,rarity,opened_ms AS at FROM club_packs WHERE user_id=?1 ORDER BY opened_ms DESC LIMIT 8",user.id),
  all(env,"SELECT kind,ref FROM club_xp_events WHERE user_id=?1 AND at_ms>=?2",user.id,Date.parse(day+"T00:00:00Z")),
  first(env,"SELECT 1 AS joined FROM club_tournament_entries WHERE week=?1 AND user_id=?2",week,user.id),
  all(env,"SELECT p.public_id AS id,p.handle,p.avatar,COALESCE(SUM(CASE e.kind WHEN 'duel-win' THEN 3 WHEN 'jackpot-win' THEN 5 ELSE 0 END),0) AS score FROM club_tournament_entries t JOIN club_players p ON p.user_id=t.user_id LEFT JOIN club_xp_events e ON e.user_id=t.user_id AND e.at_ms>=t.joined_ms AND e.at_ms<?2 AND e.kind IN ('duel-win','jackpot-win') WHERE t.week=?1 GROUP BY t.user_id ORDER BY score DESC,p.handle LIMIT 20",week,Date.parse(week+"T00:00:00Z")+7*86400000),
  all(env,"SELECT m.code,p.public_id AS id,p.handle,p.avatar FROM club_party_members m JOIN club_players p ON p.user_id=m.user_id WHERE m.code IN (SELECT code FROM club_party_members WHERE user_id=?1)",user.id),
 ]);
 const dayKinds=new Set(dayEvents.map(e=>e.kind));
 const earned = 0;
 return json({
   profile, people, boardWeek, boardDay, inventory:inventory.map(x=>x.item),
   prizes:PRIZES.map(({weight,...r})=>({...r,chance:weight})),
   duels, jackpot:{round,endsAt:(round+1)*CLUB_ROUND_MS,entrants:jackpot,
      pot:jackpot.reduce((sum,e)=>sum+e.stake,0),previous:prevJackpot},
   friends:friends.map(f=>({id:f.id,handle:f.handle,avatar:f.avatar,online:f.online,accepted:f.accepted,incoming:f.requester!==user.id && !f.accepted})),
   party:party?{...party,members:partyMembers.filter(x=>x.code===party.code)}:null,
   packs:packHistory,
   daily:{day,checked:dayKinds.has("checkin"),missions:MISSIONS.map(m=>({
     ...m,done:dayKinds.has(m.kind),claimed:dayEvents.some(e=>e.ref==="quest:"+day+":"+m.id+":"+user.id)
   }))},
   tournament:{week,isWeekend:weekend(now),joined:!!tournament,standings},
   now,onlineLabel:"Players in last 24 hours are not estimated; only registered profiles are listed.",
 });
}
export async function onRequestGet({request,env}){
 if(!configured(env))return bad("Club unavailable",503);
 const user=await currentUser(request,env);if(!user)return bad("Sign in to use BlockBet Club.",401);
 const now=Date.now();
 try {await ensure(env,user,now);return await publicState(env,user,now);}
 catch(e){console.warn("club get",e instanceof Error?e.name:"unexpected");return bad("Club temporarily unavailable.",503);}
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return bad("Invalid request origin.",403);
 if(!configured(env))return bad("Club unavailable.",503);
 const user=await currentUser(request,env);if(!user)return bad("Sign in to play with other users.",401);
 const input=await readBody(request),action=input?.action,now=Date.now(),day=dayKey(now);
 if(typeof action!=="string")return bad("Unknown action.");
 try {
  await ensure(env,user,now);
  if(!await hitRateLimit(env,"club:"+user.id,60000,30,now))return bad("Too many actions. Try again shortly.",429);
  if(action==="profile"){
    const handle=input.handle,avatar=input.avatar,banner=input.banner;
    if(!safe(handle)||!AVATARS.includes(avatar)||!BANNERS.includes(banner))return bad("Choose a valid name, avatar and banner.");
    await env.DB.prepare("UPDATE club_players SET handle=?1,avatar=?2,banner=?3 WHERE user_id=?4")
    .bind(handle.trim(),avatar,banner,user.id).run();
  }else if(action==="equip"){
    const item=input.item;
    if(typeof item!=="string" || (item!=="classic" && !PRIZES.some(p=>p.id===item)))return bad("Unknown cosmetic.");
    const allowed=item==="classic"||!!await first(env,"SELECT 1 FROM club_inventory WHERE user_id=?1 AND item=?2",user.id,item);
    if(!allowed)return bad("Unlock this cosmetic first.",403);
    await env.DB.prepare("UPDATE club_players SET equip=?1 WHERE user_id=?2").bind(item,user.id).run();
  }else if(action==="checkin"){
    const ref="daily:"+day+":"+user.id;
    if(await first(env,"SELECT 1 FROM club_xp_events WHERE ref=?1",ref))return bad("Already checked in today.",409);
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO club_xp_events(ref,user_id,kind,xp,at_ms) VALUES(?1,?2,'checkin',25,?3)").bind(ref,user.id,now),
      env.DB.prepare("INSERT OR IGNORE INTO club_points_ledger(ref,user_id,delta,created_ms) VALUES(?1,?2,120,?3)").bind(ref,user.id,now),
    ]);
  }else if(action==="pack"){
    const id=input.id;
    if(typeof id!=="string"||!CLUB_UUID.test(id))return bad("Invalid pack request.");
    const previous=await first(env,"SELECT item,rarity FROM club_packs WHERE id=?1 AND user_id=?2",id,user.id);
    if(previous)return json({ok:true,drop:previous});
    const count=await first(env,"SELECT COUNT(*) AS n FROM club_packs WHERE user_id=?1 AND opened_ms>=?2",user.id,Date.parse(day+"T00:00:00Z"));
    if(count.n>=15)return bad("Daily pack limit reached.",429);
    const itemRoll=randomInt(100);
    let chance=itemRoll,drop=PRIZES[0];
    for(const p of PRIZES){chance-=p.weight;if(chance<0){drop=p;break;}}
    const batch=await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO club_packs(id,user_id,item,rarity,opened_ms) SELECT ?1,user_id,?3,?4,?5 FROM club_players WHERE user_id=?2 AND points>=?6").bind(id,user.id,drop.id,drop.tier,now,PACK_COST),
      env.DB.prepare("INSERT OR IGNORE INTO club_points_ledger(ref,user_id,delta,created_ms) SELECT ?1,user_id,?3,?4 FROM club_packs WHERE id=?2 AND user_id=?5").bind("pack:"+id,id,-PACK_COST,now,user.id),
      env.DB.prepare("INSERT OR IGNORE INTO club_inventory(user_id,item,acquired_ms) SELECT user_id,item,?2 FROM club_packs WHERE id=?1 AND user_id=?3").bind(id,now,user.id),
      env.DB.prepare("INSERT OR IGNORE INTO club_xp_events(ref,user_id,kind,xp,at_ms) SELECT ?1,user_id,'pack',12,?3 FROM club_packs WHERE id=?2 AND user_id=?4").bind("xp:pack:"+id,id,now,user.id),
    ]);
    const awarded=await first(env,"SELECT item,rarity FROM club_packs WHERE id=?1 AND user_id=?2",id,user.id);
    if(!awarded)return bad("Not enough Club Points. Check in tomorrow to earn more.",409);
    return json({ok:true,drop:awarded});
  }else if(action==="friend-request"||action==="friend-accept"||action==="friend-remove"){
    const target=await first(env,"SELECT user_id FROM club_players WHERE public_id=?1",input.target);
    if(!target||target.user_id===user.id)return bad("Player not found.");
    const lo=user.id<target.user_id?user.id:target.user_id,hi=user.id<target.user_id?target.user_id:user.id;
    if(action==="friend-request"){
      await env.DB.prepare("INSERT OR IGNORE INTO club_friends(user_lo,user_hi,requested_by,created_ms) VALUES(?1,?2,?3,?4)").bind(lo,hi,user.id,now).run();
    }else if(action==="friend-accept"){
      const r=await env.DB.prepare("UPDATE club_friends SET accepted=1 WHERE user_lo=?1 AND user_hi=?2 AND requested_by<>?3 AND accepted=0").bind(lo,hi,user.id).run();
      if(!r.meta.changes)return bad("No incoming request from this player.",409);
    }else {
      await env.DB.prepare("DELETE FROM club_friends WHERE user_lo=?1 AND user_hi=?2").bind(lo,hi).run();
    }
  }else if(action==="party-create"){
    const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code=Array.from({length:8},()=> alphabet[randomInt(alphabet.length)]).join("");
    await env.DB.batch([
      env.DB.prepare("INSERT INTO club_parties(code,owner_id,created_ms,expires_ms) VALUES(?1,?2,?3,?4)").bind(code,user.id,now,now+3600000),
      env.DB.prepare("INSERT INTO club_party_members(code,user_id,joined_ms) VALUES(?1,?2,?3)").bind(code,user.id,now),
    ]);
    return json({ok:true,code});
  }else if(action==="party-join"){
    const code=typeof input.code==="string"?input.code.trim().toUpperCase():"";
    if(!/^[A-Z2-9]{8}$/.test(code))return bad("Enter an eight-character party code.");
    const result=await env.DB.prepare(
      "INSERT OR IGNORE INTO club_party_members(code,user_id,joined_ms) SELECT p.code,?2,?3 FROM club_parties p WHERE p.code=?1 AND p.expires_ms>?3 AND (SELECT COUNT(*) FROM club_party_members m WHERE m.code=p.code)<4"
    ).bind(code,user.id,now).run();
    if(!result.meta.changes)return bad("Party full, expired or already joined.",409);
  }else if(action==="party-leave"){
    await env.DB.prepare("DELETE FROM club_party_members WHERE user_id=?1").bind(user.id).run();
  }else if(action==="duel-create"){
    const stake=input.stake,side=input.side,id=input.id;
    if(![20,50,100,200].includes(stake)||!["heads","tails"].includes(side)||typeof id!=="string"||!CLUB_UUID.test(id))return bad("Choose a valid battle.");
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO club_duels(id,maker,stake,maker_side,created_ms,expires_ms) SELECT ?1,user_id,?3,?4,?5,?6 FROM club_players WHERE user_id=?2 AND points>=?3 AND NOT EXISTS(SELECT 1 FROM club_duels WHERE maker=?2 AND joiner IS NULL)")
        .bind(id,user.id,stake,side,now,now+10*60000),
      env.DB.prepare("INSERT OR IGNORE INTO club_points_ledger(ref,user_id,delta,created_ms) SELECT ?1,maker,-stake,?3 FROM club_duels WHERE id=?2 AND maker=?4").bind("duel:maker:"+id,id,now,user.id),
    ]);
    const created=await first(env,"SELECT id FROM club_duels WHERE id=?1 AND maker=?2",id,user.id);
    if(!created)return bad("Not enough Club Points or you already have an open battle.",409);
  }else if(action==="duel-join"){
    const id=input.id;
    if(typeof id!=="string"||!CLUB_UUID.test(id))return bad("Invalid battle.");
    const candidate=await first(env,"SELECT maker,stake,maker_side,joiner,expires_ms FROM club_duels WHERE id=?1",id);
    if(!candidate||candidate.maker===user.id||candidate.joiner||candidate.expires_ms<=now)return bad("Battle is unavailable.",409);
    const enough=await first(env,"SELECT points FROM club_players WHERE user_id=?1",user.id);
    if(enough.points<candidate.stake)return bad("Not enough Club Points.",409);
    const outcome=randomInt(2)===0?"heads":"tails";
    // The UPDATE picks one joining player; all ledgers are unique and settle exactly once.
    await env.DB.batch([
      env.DB.prepare("UPDATE club_duels SET joiner=?1,outcome=?2,winner_id=CASE WHEN maker_side=?2 THEN maker ELSE ?1 END WHERE id=?3 AND joiner IS NULL AND expires_ms>?4 AND maker<>?1 AND EXISTS(SELECT 1 FROM club_players WHERE user_id=?1 AND points>=stake)")
        .bind(user.id,outcome,id,now),
      env.DB.prepare("INSERT OR IGNORE INTO club_points_ledger(ref,user_id,delta,created_ms) SELECT ?1,joiner,-stake,?3 FROM club_duels WHERE id=?2 AND joiner=?4").bind("duel:join:"+id,id,now,user.id),
      env.DB.prepare("INSERT OR IGNORE INTO club_points_ledger(ref,user_id,delta,created_ms) SELECT ?1,winner_id,stake*2,?3 FROM club_duels WHERE id=?2 AND joiner=?4 AND winner_id IS NOT NULL").bind("duel:payout:"+id,id,now,user.id),
      env.DB.prepare("INSERT OR IGNORE INTO club_xp_events(ref,user_id,kind,xp,at_ms) SELECT ?1,joiner,'duel',15,?3 FROM club_duels WHERE id=?2 AND joiner=?4").bind("xp:duel:join:"+id,id,now,user.id),
      env.DB.prepare("INSERT OR IGNORE INTO club_xp_events(ref,user_id,kind,xp,at_ms) SELECT ?1,winner_id,'duel-win',35,?3 FROM club_duels WHERE id=?2 AND joiner=?4").bind("xp:duel:win:"+id,id,now,user.id),
    ]);
    const finished=await first(env,"SELECT winner_id,outcome FROM club_duels WHERE id=?1 AND joiner=?2",id,user.id);
    if(!finished)return bad("Another player already joined.",409);
    return json({ok:true,outcome:finished.outcome,won:finished.winner_id===user.id});
  }else if(action==="duel-cancel"){
    const id=input.id;
    if(typeof id!=="string"||!CLUB_UUID.test(id))return bad("Invalid battle.");
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO club_points_ledger(ref,user_id,delta,created_ms) SELECT ?1,maker,stake,?3 FROM club_duels WHERE id=?2 AND maker=?4 AND joiner IS NULL").bind("duel:refund:"+id,id,now,user.id),
      env.DB.prepare("DELETE FROM club_duels WHERE id=?1 AND maker=?2 AND joiner IS NULL").bind(id,user.id),
    ]);
  }else if(action==="jackpot-join"){
    const stake=input.stake,round=input.round,nowRound=Math.floor(now/CLUB_ROUND_MS);
    if(![20,50,100,200].includes(stake)||round!==nowRound)return bad("Jackpot round has changed.",409);
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO club_jackpot_entries(round,user_id,stake,joined_ms) SELECT ?1,user_id,?3,?4 FROM club_players WHERE user_id=?2 AND points>=?3 AND CAST(unixepoch()*1000 / 120000 AS INTEGER)=?1").bind(round,user.id,stake,now),
      env.DB.prepare("INSERT OR IGNORE INTO club_points_ledger(ref,user_id,delta,created_ms) SELECT ?1,user_id,-stake,?3 FROM club_jackpot_entries WHERE round=?2 AND user_id=?4").bind("jackpot:entry:"+round+":"+user.id,round,now,user.id),
      env.DB.prepare("INSERT OR IGNORE INTO club_xp_events(ref,user_id,kind,xp,at_ms) SELECT ?1,user_id,'jackpot',12,?3 FROM club_jackpot_entries WHERE round=?2 AND user_id=?4").bind("xp:jackpot:entry:"+round+":"+user.id,round,now,user.id),
    ]);
    const entry=await first(env,"SELECT stake FROM club_jackpot_entries WHERE round=?1 AND user_id=?2",round,user.id);
    if(!entry)return bad("Not enough Club Points or this round closed.",409);
  }else if(action==="tournament-join"){
    if(!weekend(now))return bad("Weekend tournament opens Saturday 00:00 UTC.",409);
    await env.DB.prepare("INSERT OR IGNORE INTO club_tournament_entries(week,user_id,joined_ms) VALUES(?1,?2,?3)").bind(monday(now),user.id,now).run();
  }else if(action==="claim-mission"){
    const id=input.mission;
    if(!MISSIONS.some(m=>m.id===id))return bad("Unknown mission.");
    const ref="quest:"+day+":"+id+":"+user.id;
    if(await first(env,"SELECT 1 FROM club_xp_events WHERE ref=?1",ref))return bad("Already claimed.",409);
    const evidence=await first(env,"SELECT 1 FROM club_xp_events WHERE user_id=?1 AND kind=?2 AND at_ms>=?3 LIMIT 1",user.id,id,Date.parse(day+"T00:00:00Z"));
    if(!evidence)return bad("Complete the mission first.",409);
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO club_xp_events(ref,user_id,kind,xp,at_ms) VALUES(?1,?2,'quest',30,?3)").bind(ref,user.id,now),
      env.DB.prepare("INSERT OR IGNORE INTO club_points_ledger(ref,user_id,delta,created_ms) VALUES(?1,?2,70,?3)").bind(ref,user.id,now),
    ]);
  }else return bad("Unknown Club action.");
  return publicState(env,user,now);
 }catch(e){console.warn("club post",e instanceof Error?e.name:"unexpected");return bad("Could not complete this Club action. Try again.",503);}
}
