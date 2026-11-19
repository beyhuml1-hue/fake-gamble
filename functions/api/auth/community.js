import { configured, currentUser, publicDisplayName, hitRateLimit, json, readBody, sameOrigin } from "../../_shared/auth.js";

const ROUND_MS = 7 * 60_000;
const RAIN_CENTS = 1_000;
const named = ({ email, ...row }) => ({ ...row, label:publicDisplayName(email) });
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export async function preparePlayer(env, user, round) {
  const label = publicDisplayName(user.email);
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO community_profiles (user_id,public_id,label) VALUES (?1,?2,?3)"
    ).bind(user.id, crypto.randomUUID(), label),
    env.DB.prepare("UPDATE community_rain SET paid = 1 WHERE user_id = ?1 AND paid = 0 AND round < MIN(?2, CAST(unixepoch() / 420 AS INTEGER))")
      .bind(user.id, round),
  ]);
}

export async function onRequestGet({ request, env }) {
  if (!configured(env)) return json({ error: "Chat is unavailable." }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: "Log in to open chat." }, 401);
  const now = Date.now();
  const round = Math.floor(now / ROUND_MS);
  await preparePlayer(env, user, round);
  const queriedPlayer=new URL(request.url).searchParams.get("player");
  if(queriedPlayer!==null){
    if(!UUID.test(queriedPlayer))return json({error:"Invalid player."},400);
    const target=await env.DB.prepare("SELECT p.user_id,p.public_id AS id,u.email FROM community_profiles p JOIN auth_users u ON u.id=p.user_id WHERE p.public_id=?1").bind(queriedPlayer).first();
    if(!target)return json({error:"Player not found."},404);
    // These are user-submitted settled bets, not audited casino settlements.
    const stats=await env.DB.prepare(
      "SELECT COUNT(*) AS bets,COALESCE(SUM(wager),0) AS wageredCents,"+
      "COALESCE(SUM(CASE WHEN payout>wager THEN payout-wager ELSE 0 END),0) AS wonCents,"+
      "COALESCE(SUM(CASE WHEN wager>payout THEN wager-payout ELSE 0 END),0) AS lostCents,"+
      "COALESCE(SUM(payout-wager),0) AS netCents,"+
      "COALESCE(SUM(CASE WHEN payout>wager THEN 1 ELSE 0 END),0) AS wins,"+
      "COALESCE(SUM(CASE WHEN wager>payout THEN 1 ELSE 0 END),0) AS losses "+
      "FROM auth_live_bets WHERE user_id=?1"
    ).bind(target.user_id).first();
    return json({player:{id:target.id,label:publicDisplayName(target.email)},stats,source:"Reported community bets; records may be incomplete and are not server-audited."});
  }
  const [profile, rain, chat, players] = await env.DB.batch([
    env.DB.prepare("SELECT public_id AS id, label FROM community_profiles WHERE user_id = ?1").bind(user.id),
    env.DB.prepare(
      "SELECT COUNT(*) AS count, COALESCE(MAX(user_id = ?2), 0) AS joined FROM community_rain WHERE round = ?1"
    ).bind(round, user.id),
    env.DB.prepare(
      "SELECT m.id, p.public_id AS playerId, u.email, m.body, m.kind, m.at_ms AS at FROM community_messages m " +
      "JOIN community_profiles p ON p.user_id = m.user_id JOIN auth_users u ON u.id = m.user_id " +
      "WHERE m.at_ms > ?1 AND NOT EXISTS (SELECT 1 FROM auth_account_controls c WHERE c.user_id = m.user_id AND c.banned = 1) " +
      "ORDER BY m.at_ms DESC, m.id DESC LIMIT 40"
    ).bind(now - 24 * 60 * 60_000),
    env.DB.prepare("SELECT p.public_id AS id,u.email FROM community_profiles p JOIN auth_users u ON u.id=p.user_id ORDER BY label LIMIT 80"),
  ]);
  return json({
    profile: { id:profile.results[0].id, label:publicDisplayName(user.email) },
    rain: { ...rain.results[0], cents:(await env.DB.prepare("SELECT cents FROM rain_pots WHERE round=?1").bind(round).first())?.cents??RAIN_CENTS, round, now, endsAt: (round + 1) * ROUND_MS },
    messages: chat.results.reverse().map(named),
    players: (players.results || []).map(named),
  });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!configured(env)) return json({ error: "Chat is unavailable." }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: "Log in to use chat." }, 401);
  const input = await readBody(request);
  const action = input?.action;
  const now = Date.now();
  const round = Math.floor(now / ROUND_MS);
  if (!["message", "join", "transfer", "contribute"].includes(action)) return json({ error: "Unknown action." }, 400);
  if (!await hitRateLimit(env, "community:" + user.id, 60_000, 24, now)) {
    return json({ error: "Wait a moment and try again." }, 429);
  }
  await preparePlayer(env, user, round);

  if (action === "message") {
    const body = typeof input.body === "string" ? input.body.trim() : "";
    if (!body || body.length > 240) return json({ error: "Enter a message of 1 to 240 characters." }, 400);
    await env.DB.prepare("INSERT INTO community_messages (id,user_id,body,at_ms) VALUES (?1,?2,?3,?4)")
      .bind(crypto.randomUUID(), user.id, body, now).run();
    if (Math.floor(now / 1000) % 19 === 0) {
      await env.DB.prepare("DELETE FROM community_messages WHERE at_ms < ?1").bind(now - 24 * 60 * 60_000).run();
    }
    return json({ ok: true }, 201);
  }

  if (action === "join") {
    if (input.round !== round) return json({ error: "That round closed. Join the new round." }, 409);
    // Check database time too, so a queued request cannot add entries after settlement starts.
    await env.DB.prepare(
      "INSERT OR IGNORE INTO community_rain (round,user_id) SELECT ?1,?2 " +
      "WHERE CAST(unixepoch() / 420 AS INTEGER) = ?1 " +
      "AND (SELECT COUNT(*) FROM community_rain WHERE round = ?1) < ?3"
    ).bind(round, user.id, RAIN_CENTS).run();
    const entry = await env.DB.prepare("SELECT 1 FROM community_rain WHERE round = ?1 AND user_id = ?2").bind(round, user.id).first();
    return entry ? json({ ok: true }) : json({ error: "That round is full or closed." }, 409);
  }

  if(action === "contribute"){
    const {id,cents}=input;
    if(typeof id!=="string"||!UUID.test(id)||!Number.isSafeInteger(cents)||cents<1||cents>100_000_000)return json({error:"Enter a valid Rain amount."},400);
    if(input.round!==round)return json({error:"That round closed. Try the new Rain."},409);
    const [written,existing]=await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO rain_contributions(id,user_id,round,cents,at_ms) SELECT ?1,?2,?3,?4,?5 FROM playusd_wallets w WHERE w.user_id=?2 AND w.initialized=1 AND w.cents>=?4 AND CAST(unixepoch()/420 AS INTEGER)=?3 AND ?4<=10000000000-COALESCE((SELECT cents FROM rain_pots WHERE round=?3),1000) AND NOT EXISTS(SELECT 1 FROM community_rain WHERE round=?3 AND paid=1)").bind(id,user.id,round,cents,now),
      env.DB.prepare("SELECT 1 FROM rain_contributions WHERE id=?1 AND user_id=?2 AND cents=?3 AND round=?4").bind(id,user.id,cents,round)
    ]);
    return written.meta.changes||existing.results.length?json({ok:true}):json({error:"Insufficient balance or Rain has closed."},409);
  }
  const { id, recipient, cents } = input;
  if (typeof id !== "string" || !UUID.test(id) || typeof recipient !== "string" ||
      !UUID.test(recipient) || !Number.isSafeInteger(cents) || cents < 1 || cents > 100_000_000) {
    return json({ error: "Enter a valid Play USD amount." }, 400);
  }
  const [,written,existing] = await env.DB.batch([
    // A recipient who hasn't opened the new wallet keeps incoming credits
    // pending until their original local Play USD balance is imported.
    env.DB.prepare(
      "INSERT OR IGNORE INTO playusd_wallets(user_id,cents,initialized,updated_ms) "+
      "SELECT user_id,0,0,?2 FROM community_profiles WHERE public_id=?1"
    ).bind(recipient,now),
    env.DB.prepare(
      "INSERT OR IGNORE INTO community_transfers(id,sender,recipient,cents) "+
      "SELECT ?1,s.user_id,r.user_id,?4 FROM community_profiles s "+
      "JOIN community_profiles r ON r.public_id=?3 "+
      "JOIN playusd_wallets w ON w.user_id=s.user_id "+
      "JOIN playusd_wallets rw ON rw.user_id=r.user_id "+
      "WHERE s.user_id=?2 AND r.public_id=?3 AND s.user_id<>r.user_id "+
      "AND w.initialized=1 AND w.cents>=?4 AND ?4<=9007199254740991-rw.cents "+
      "AND NOT EXISTS (SELECT 1 FROM auth_account_controls c WHERE c.user_id=r.user_id AND c.banned=1)"
    ).bind(id,user.id,recipient,cents),
    env.DB.prepare(
      "SELECT 1 FROM community_transfers t JOIN community_profiles r ON r.user_id=t.recipient "+
      "WHERE t.id=?1 AND t.sender=?2 AND r.public_id=?3 AND t.cents=?4"
    ).bind(id,user.id,recipient,cents),
  ]);
  return written.meta.changes || existing.results.length
    ? json({ ok: true })
    : json({ error: "Insufficient Play USD or player unavailable." }, 409);
}
