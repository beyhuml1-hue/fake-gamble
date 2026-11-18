import {initializeCard} from "../../_shared/demo-voucher.js";
import { configured, currentUser, digest, isAdmin, json, readBody, sameHash, sameOrigin, validEmail } from "../../_shared/auth.js";

async function authorize({ request, env }) {
  if (!configured(env)) return json({ error: "Account service unavailable." }, 503);
  const user = await currentUser(request, env);
  if (!isAdmin(user, env)) return json({ error: "Owner access required." }, 403);
  // Password must be configured as a Cloudflare encrypted secret.
  if (typeof env.ADMIN_PANEL_PASSWORD !== "string" || env.ADMIN_PANEL_PASSWORD.length < 8)
    return json({ error: "Set ADMIN_PANEL_PASSWORD in Cloudflare first." }, 503);
  const supplied = request.headers.get("X-Blockbet-Admin-Key") || "";
  if (supplied.length > 128) return json({ error: "Invalid admin password." }, 401);
  const actual = await digest("admin:" + supplied, env.AUTH_PEPPER);
  const expected = await digest("admin:" + env.ADMIN_PANEL_PASSWORD, env.AUTH_PEPPER);
  return sameHash(actual, expected) ? null : json({ error: "Invalid admin password." }, 401);
}

const accountQuery =
  "SELECT u.email, COALESCE(c.banned,0) AS banned, COALESCE(c.paused,0) AS paused,COALESCE(c.luck_mode,'normal') AS luckMode,c.bomb_tile AS bombTile," +
  "w.cents AS balanceCents, p.seen_ms AS seenMs,p.page AS page,u.last_login_ms AS lastLoginMs," +
  "(SELECT game FROM pvp_rooms r WHERE (r.host_id=u.id OR r.guest_id=u.id) AND r.status IN ('waiting','active') ORDER BY r.updated_ms DESC LIMIT 1) AS activeGame " +
  "FROM auth_users u LEFT JOIN auth_account_controls c ON c.user_id=u.id " +
  "LEFT JOIN playusd_wallets w ON w.user_id=u.id LEFT JOIN auth_presence p ON p.user_id=u.id";
function present(account) {
  return account ? {...account,online:!!account.seenMs && Date.now()-account.seenMs<45000} : account;
}

export async function onRequestGet(context) {
  const denied = await authorize(context);
  if (denied) return denied;
  const email = validEmail(new URL(context.request.url).searchParams.get("email"));
  if (!email && new URL(context.request.url).searchParams.has("list")) {
    const rows=await context.env.DB.prepare(accountQuery+" ORDER BY p.seen_ms DESC,u.last_login_ms DESC LIMIT 150").all();
    const details=await initializeCard(context.env);
    const balance=await context.env.DB.prepare("SELECT balance_cents FROM demo_shared_voucher WHERE id=1").first();
    return json({accounts:(rows.results||[]).map(present),demoCard:{...details,remainingCents:balance?.balance_cents??0}});
  }
  if (!email) return json({ error: "Enter an account email." }, 400);
  const account = await context.env.DB.prepare(accountQuery+" WHERE u.email=?1").bind(email).first();
  return account ? json({ account:present(account) }) : json({ error: "Account not found." }, 404);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const denied = await authorize(context);
  if (denied) return denied;
  const input = await readBody(request);
  const email = validEmail(input?.email);
  if (!email) return json({ error: "Enter an account email." }, 400);
  const target = await env.DB.prepare("SELECT id, email FROM auth_users WHERE email = ?1").bind(email).first();
  if (!target) return json({ error: "Account not found." }, 404);

  if (["reset","delete"].includes(input.action)) {
    if (isAdmin(target,env)) return json({error:"Owner account cannot be reset or deleted."},400);
    if (input.confirm !== email) return json({error:"Type the full account email to confirm this action."},400);
    const now=Date.now();
    // Close affected PvP rooms before changing balances: existing escrow trigger
    // refunds waiting hosts and awards active opponents when accounts are deleted.
    await env.DB.prepare("UPDATE pvp_rooms SET status=CASE WHEN status='waiting' THEN 'cancelled' ELSE 'finished' END,"+
      "winner_id=CASE WHEN status='waiting' THEN NULL WHEN host_id=?1 THEN guest_id ELSE host_id END,"+
      "result_text='Match ended by account management.',updated_ms=?2,finished_ms=?2 "+
      "WHERE (host_id=?1 OR guest_id=?1) AND status IN ('waiting','active')")
      .bind(target.id,now).run();
    if(input.action==="reset") {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM playusd_game_ops WHERE user_id=?1").bind(target.id),
        env.DB.prepare("DELETE FROM auth_live_bets WHERE user_id=?1").bind(target.id),
        env.DB.prepare("DELETE FROM community_messages WHERE user_id=?1").bind(target.id),
        env.DB.prepare("DELETE FROM ai_messages WHERE user_id=?1").bind(target.id),
        env.DB.prepare("DELETE FROM ai_memory WHERE user_id=?1").bind(target.id),
        env.DB.prepare("INSERT OR IGNORE INTO auth_account_controls(user_id) VALUES(?1)").bind(target.id),
        env.DB.prepare("UPDATE auth_account_controls SET balance_cents=100000,balance_revision=?1,balance_mode='reset',luck_mode='normal',bomb_tile=NULL WHERE user_id=?2").bind(crypto.randomUUID(),target.id),
        env.DB.prepare("INSERT INTO playusd_wallets(user_id,cents,initialized,updated_ms) VALUES(?1,100000,1,?2) ON CONFLICT(user_id) DO UPDATE SET cents=100000,initialized=1,updated_ms=excluded.updated_ms").bind(target.id,now),
        env.DB.prepare("INSERT INTO admin_account_audit(id,actor_email,target_email,action,at_ms) VALUES(?1,?2,?3,'reset',?4)").bind(crypto.randomUUID(),(await currentUser(request,env)).email,email,now)
      ]);
      return json({ok:true,account:present(await env.DB.prepare(accountQuery+" WHERE u.email=?1").bind(email).first())});
    }
    // Order deletes by dependency. A hard delete is deliberately irreversible.
    const deletes=[
      "DELETE FROM community_notifications WHERE recipient_id=?1 OR sender_id=?1",
      "DELETE FROM community_transfers WHERE sender=?1 OR recipient=?1",
      "DELETE FROM community_rain WHERE user_id=?1",
      "DELETE FROM rain_contributions WHERE user_id=?1",
      "DELETE FROM community_messages WHERE user_id=?1",
      "DELETE FROM community_wallet_events WHERE user_id=?1",
      "DELETE FROM demo_voucher_redemptions WHERE user_id=?1",
      "DELETE FROM auth_live_bets WHERE user_id=?1",
      "DELETE FROM playusd_game_ops WHERE user_id=?1",
      "DELETE FROM pvp_rooms WHERE host_id=?1 OR guest_id=?1 OR winner_id=?1",
      "DELETE FROM mines_battle_rooms WHERE host_id=?1 OR guest_id=?1 OR winner_id=?1",
      "DELETE FROM auth_presence WHERE user_id=?1",
      "DELETE FROM auth_sessions WHERE user_id=?1",
      "DELETE FROM ai_messages WHERE user_id=?1",
      "DELETE FROM ai_memory WHERE user_id=?1",
      "DELETE FROM community_profiles WHERE user_id=?1",
      "DELETE FROM playusd_wallets WHERE user_id=?1",
      "DELETE FROM auth_account_controls WHERE user_id=?1",
      "DELETE FROM auth_users WHERE id=?1"
    ].map(sql=>env.DB.prepare(sql).bind(target.id));
    deletes.push(env.DB.prepare("DELETE FROM auth_otp WHERE email=?1").bind(email));
    deletes.push(env.DB.prepare("DELETE FROM auth_pending WHERE email=?1").bind(email));
    deletes.push(env.DB.prepare("INSERT INTO admin_account_audit(id,actor_email,target_email,action,at_ms) VALUES(?1,?2,?3,'delete',?4)").bind(crypto.randomUUID(),(await currentUser(request,env)).email,email,now));
    await env.DB.batch(deletes);
    return json({ok:true,deleted:true});
  }
  if (input.action === "balance") {
    const cents = input.cents;
    if (!Number.isInteger(cents) || cents < 0 || cents > 10_000_000_000) {
      return json({ error: "Enter an amount from $0.00 to $100,000,000.00." }, 400);
    }
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO auth_account_controls (user_id, balance_cents, balance_revision, balance_mode) VALUES (?1, ?2, ?3, 'set') " +
        "ON CONFLICT(user_id) DO UPDATE SET balance_cents = excluded.balance_cents, balance_revision = excluded.balance_revision, balance_mode = 'set'"
      ).bind(target.id, cents, crypto.randomUUID()),
      env.DB.prepare(
        "INSERT INTO playusd_wallets(user_id,cents,initialized,updated_ms) VALUES(?1,?2,1,?3) " +
        "ON CONFLICT(user_id) DO UPDATE SET cents=excluded.cents,initialized=1,updated_ms=excluded.updated_ms"
      ).bind(target.id,cents,Date.now()),
    ]);
  } else if(input.action==="bomb"){
    if(input.tile!==null&&(!Number.isInteger(input.tile)||input.tile<0||input.tile>24))
      return json({error:"Choose a tile from 1 to 25, or clear the override."},400);
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO auth_account_controls(user_id) VALUES(?1)").bind(target.id),
      env.DB.prepare("UPDATE auth_account_controls SET bomb_tile=?1 WHERE user_id=?2").bind(input.tile,target.id)
    ]);
  } else if (input.action === "luck") {
    if (!["normal","hot","cold"].includes(input.mode)) return json({error:"Choose a simulation mode."},400);
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO auth_account_controls(user_id) VALUES(?1)").bind(target.id),
      env.DB.prepare("UPDATE auth_account_controls SET luck_mode=?1 WHERE user_id=?2").bind(input.mode,target.id),
    ]);
  } else if (input.action === "pause" || input.action === "unpause") {
    if (isAdmin(target, env)) return json({ error: "Owner account cannot be paused." }, 400);
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO auth_account_controls(user_id) VALUES(?1)").bind(target.id),
      env.DB.prepare("UPDATE auth_account_controls SET paused=?1 WHERE user_id=?2")
        .bind(Number(input.action === "pause"),target.id),
    ]);
  } else if (input.action === "ban" || input.action === "unban") {
    if (isAdmin(target, env)) return json({ error: "The owner account cannot be banned." }, 400);
    const banned = input.action === "ban";
    const statements = [env.DB.prepare(
      "INSERT INTO auth_account_controls (user_id, banned) VALUES (?1, ?2) " +
      "ON CONFLICT(user_id) DO UPDATE SET banned = excluded.banned"
    ).bind(target.id, Number(banned))];
    // Keep the session cookie for the restricted-account screen. All actions are denied by currentUser().
    await env.DB.batch(statements);
  } else {
    return json({ error: "Unknown account action." }, 400);
  }
  return json({ account: present(await env.DB.prepare(accountQuery+" WHERE u.email=?1").bind(email).first()) });
}
