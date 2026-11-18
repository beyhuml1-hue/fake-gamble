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
  "SELECT u.email, COALESCE(c.banned,0) AS banned, COALESCE(c.paused,0) AS paused,COALESCE(c.luck_mode,'normal') AS luckMode," +
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
