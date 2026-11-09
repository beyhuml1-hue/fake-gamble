import { json, currentUser, dbReady, sameOrigin, readBody, digest, hitRateLimit } from "../../_shared/auth.js";

const GAMES = new Set([
  "Dice","Mines","Plinko","Crash","Limbo","Keno","Wheel","Hi-Lo",
  "Blackjack","Roulette","Dragon Tower","Flip","Diamonds","Baccarat",
  "Pump","Cases","Upgrader","Chicken Road","Darts",
]);
const HEADERS = {"Cache-Control":"no-store"};

export async function onRequestGet({ env }) {
  if (!(await dbReady(env))) return json({ error:"Live bets currently unavailable." },503);
  try {
    const rows=await env.DB.prepare(
      "SELECT id, label, game, wager, payout, at_ms AS at FROM auth_live_bets " +
      "WHERE at_ms > ?1 ORDER BY at_ms DESC, id DESC LIMIT 30"
    ).bind(Date.now()-24*3600*1000).all();
    return json({ bets:rows.results || [], live:true, notice:"Real player-submitted demo bets. Credits are fictional and outcomes are not server-audited." },200,HEADERS);
  } catch {
    return json({error:"Live bets feed is temporarily offline."},503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({error:"Invalid request origin."},403);
  if (!(await dbReady(env))) return json({error:"Live bets temporarily unavailable."},503);
  const user=await currentUser(request,env);
  if (!user) return json({error:"Sign in to share demo bets."},401);
  const body=await readBody(request);
  const id=typeof body?.id==="string" && /^[0-9a-f-]{36}$/.test(body.id)?body.id:null;
  const game=typeof body?.game==="string"&&GAMES.has(body.game)?body.game:null;
  const wager=body?.wager;
  const payout=body?.payout;
  if(!id||!game||!Number.isInteger(wager)||wager<10||wager>100_000_000||
     !Number.isInteger(payout)||payout<0||payout>500_000_000) {
    return json({error:"Invalid demo bet."},400);
  }
  try {
    const now=Date.now();
    const allowed=await hitRateLimit(env,"live-user:"+user.id,3600000,120,now);
    if(!allowed) return json({error:"Too many live bet updates."},429);
    const label="Player "+(await digest("feed:"+user.id,env.AUTH_PEPPER)).slice(0,6).toUpperCase();
    await env.DB.prepare(
      "INSERT INTO auth_live_bets (id,user_id,label,game,wager,payout,at_ms) " +
      "VALUES (?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO NOTHING"
    ).bind(id,user.id,label,game,wager,payout,now).run();
    // Keep a small, bounded public feed. No emails are ever exposed.
    if(Math.floor(now/1000)%17===0) {
      await env.DB.prepare("DELETE FROM auth_live_bets WHERE at_ms < ?1")
        .bind(now-7*24*3600000).run();
    }
    return json({ok:true},201);
  } catch {
    return json({error:"Could not share demo bet."},503);
  }
}
