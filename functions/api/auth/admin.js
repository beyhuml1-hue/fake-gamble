import { configured, currentUser, isAdmin, json, readBody, sameOrigin, validEmail, digest, sameHash, hitRateLimit } from "../../_shared/auth.js";

// The password is verified only on the server, never shipped to the frontend.
// An authenticated account session AND a short-lived signed owner unlock are required.
// Override ADMIN_PASSWORD_SHA256 with a server secret when rotating owner credentials.
const ADMIN_PASSWORD_SHA256 = "0ce74f7a9edcdd4b989bf73fd58e17e18feb0f9f2b21c01391a1510b4608ac0c";
const ADMIN_COOKIE = "bb_admin_unlock";
const ADMIN_TTL = 60 * 60 * 1000;
const MAX_CENTS = Number.MAX_SAFE_INTEGER;
const START_AVERAGE_CENTS = 100_000;

function asCount(value) {
  const n = typeof value === "bigint" ? Number(value) : Number(value || 0);
  return Number.isSafeInteger(n) ? n : 0;
}

async function economySnapshot(env) {
  const row = await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM playusd_wallets WHERE initialized=1) AS wallets, " +
    "(SELECT COALESCE(SUM(cents),0) FROM playusd_wallets WHERE initialized=1) AS circulation, " +
    "(SELECT COALESCE(SUM(stake),0) FROM economy_wagers) AS wagered, " +
    "(SELECT COALESCE(units,0) FROM house_treasury WHERE id=1) AS treasury"
  ).first();
  const wallets = asCount(row?.wallets);
  const circulationCents = asCount(row?.circulation);
  const wageredCents = asCount(row?.wagered);
  const treasuryUnits = asCount(row?.treasury);
  const average = wallets ? circulationCents / wallets : 0;
  const strength = Math.max(0, Math.min(100, Math.round((average / START_AVERAGE_CENTS) * 50)));
  return { wallets, circulationCents, wageredCents, treasuryUnits, strength };
}

async function publishBalances(env, revision) {
  await env.DB.prepare(
    "INSERT INTO auth_account_controls (user_id, banned, balance_cents, balance_revision, balance_mode) " +
    "SELECT user_id, 0, cents, ?1, 'set' FROM playusd_wallets WHERE initialized=1 " +
    "ON CONFLICT(user_id) DO UPDATE SET balance_cents=excluded.balance_cents, " +
    "balance_revision=excluded.balance_revision, balance_mode='set'"
  ).bind(revision).run();
}

async function setCirculation(env, user, targetCents) {
  const before = await economySnapshot(env);
  if (!before.wallets) return { error: json({ error: "There are no wallets to change." }, 400) };
  if (!Number.isSafeInteger(targetCents) || targetCents < 0 || targetCents > MAX_CENTS) {
    return { error: json({ error: "Enter a valid Play USD total." }, 400) };
  }
  const now = Date.now();
  const revision = crypto.randomUUID();
  if (before.circulationCents === 0) {
    const each = Math.floor(targetCents / before.wallets);
    await env.DB.prepare(
      "UPDATE playusd_wallets SET cents=?1, updated_ms=?2, generation=generation+1 WHERE initialized=1"
    ).bind(each, now).run();
  } else {
    await env.DB.prepare(
      "UPDATE playusd_wallets SET cents=MIN(9007199254740991, CAST(ROUND(CAST(cents AS REAL) * ?1 / ?2) AS INTEGER)), " +
      "updated_ms=?3, generation=generation+1 WHERE initialized=1"
    ).bind(targetCents, before.circulationCents, now).run();
  }
  await publishBalances(env, revision);
  await env.DB.prepare(
    "INSERT INTO economy_supply_actions(id,actor_id,action,cents,at_ms) VALUES(?1,?2,'supply',?3,?4)"
  ).bind(revision, user.id, targetCents, now).run();
  return { economy: await economySnapshot(env) };
}

function cookieValue(request) {
  const cookies = request.headers.get("Cookie") || "";
  const item = cookies.split(";").map(part => part.trim()).find(part => part.startsWith(ADMIN_COOKIE + "="));
  return item ? item.slice(ADMIN_COOKIE.length + 1) : "";
}

async function unlocked(request, env, user) {
  if (!user) return false;
  const parts = cookieValue(request).split(".");
  if (parts.length !== 2 || !/^\d{13}$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[1])) return false;
  const expires = Number(parts[0]);
  if (!Number.isSafeInteger(expires) || expires < Date.now() || expires > Date.now() + ADMIN_TTL) return false;
  const signature = await digest("admin-unlock:" + user.id + ":" + expires, env.AUTH_PEPPER);
  return sameHash(signature, parts[1]);
}

async function authorize({ request, env }) {
  if (!configured(env)) return { error: json({ error: "Account service unavailable." }, 503) };
  const user = await currentUser(request, env);
  if (!user) return { error: json({ error: "Log in to your PlayBlockBet account first." }, 401) };
  if (!isAdmin(user, env)) return { error: json({ error: "Owner access required." }, 403) };
  if (!await unlocked(request, env, user)) return { error: json({ error: "Enter the admin password to unlock account controls.", locked: true }, 403) };
  return { user };
}

const accountColumns =
  "SELECT u.email, p.label, COALESCE(c.banned,0) AS banned, " +
  "w.cents AS balanceCents, COALESCE(w.initialized,0) AS walletReady, " +
  "c.balance_cents AS lastAdjustment " +
  "FROM auth_users u LEFT JOIN community_profiles p ON p.user_id=u.id " +
  "LEFT JOIN auth_account_controls c ON c.user_id=u.id " +
  "LEFT JOIN playusd_wallets w ON w.user_id=u.id ";

export async function onRequestGet(context) {
  const { request, env } = context;
  const denied = await authorize(context);
  if (denied.error) return denied.error;
  const url = new URL(request.url);
  if (url.searchParams.get("view") === "session") return json({ ok: true, unlocked: true });
  if (url.searchParams.get("view") === "economy") return json({ ok: true, economy: await economySnapshot(env) });
  const query = (url.searchParams.get("q") || url.searchParams.get("email") || "").trim().toLowerCase();
  if (query.length > 254) return json({ error: "Search is too long." }, 400);
  const rows = await env.DB.prepare(
    accountColumns +
    "WHERE (?1 = '' OR lower(u.email) LIKE ?2 OR lower(COALESCE(p.label,'')) LIKE ?2) " +
    "ORDER BY u.email LIMIT 80"
  ).bind(query, "%" + query.replace(/[%_\\]/g, "") + "%").all();
  return json({ accounts: rows.results || [] });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!configured(env)) return json({ error: "Account service unavailable." }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: "Log in to your PlayBlockBet account first." }, 401);
  if (!isAdmin(user, env)) return json({ error: "Owner access required." }, 403);
  const input = await readBody(request);
  if (input?.action === "unlock") {
    if (!await hitRateLimit(env, "admin-unlock:" + user.id, 15 * 60_000, 6, Date.now())) {
      return json({ error: "Too many password attempts. Try again in 15 minutes." }, 429);
    }
    const password = input.password;
    if (typeof password !== "string" || password.length > 128) return json({ error: "Invalid password." }, 400);
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    const candidate = Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2,"0")).join("");
    if (!sameHash(candidate, env.ADMIN_PASSWORD_SHA256 || ADMIN_PASSWORD_SHA256)) return json({ error: "Incorrect admin password." }, 403);
    const expires = Date.now() + ADMIN_TTL;
    const token = expires + "." + await digest("admin-unlock:" + user.id + ":" + expires, env.AUTH_PEPPER);
    return json({ ok: true, unlocked: true }, 200, {
      "Set-Cookie": ADMIN_COOKIE + "=" + token + "; Path=/api/auth/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=3600",
    });
  }
  if (input?.action === "lock") {
    return json({ ok: true, unlocked: false }, 200, {
      "Set-Cookie": ADMIN_COOKIE + "=; Path=/api/auth/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
    });
  }
  const denied = await authorize(context);
  if (denied.error) return denied.error;
  if (input.action === "supply" || input.action === "strength") {
    let target = input.cents;
    if (input.action === "strength") {
      const strength = input.strength;
      if (!Number.isInteger(strength) || strength < 0 || strength > 100) return json({ error: "Strength is a whole number from 0 to 100." }, 400);
      const snap = await economySnapshot(env);
      target = Math.round(snap.wallets * START_AVERAGE_CENTS * (strength / 50));
    }
    const scaled = await setCirculation(env, user, target);
    if (scaled.error) return scaled.error;
    return json({ ok: true, economy: scaled.economy });
  }
  const email = validEmail(input?.email);
  if (!email) return json({ error: "Select a player account." }, 400);
  const target = await env.DB.prepare("SELECT id,email FROM auth_users WHERE email=?1").bind(email).first();
  if (!target) return json({ error: "Account not found." }, 404);

  if (input.action === "balance" || input.action === "add" || input.action === "subtract") {
    const cents = input.cents;
    if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_CENTS) return json({ error: "Enter a valid non-negative Play USD amount." }, 400);
    try {
      await env.DB.prepare("INSERT INTO admin_account_actions(id,actor_id,target_id,action,cents,at_ms) VALUES(?1,?2,?3,?4,?5,?6)")
        .bind(crypto.randomUUID(),user.id,target.id,input.action,cents,Date.now()).run();
    } catch {
      return json({ error: "Balance update failed. Refresh the account and check the amount." }, 409);
    }
  } else if (input.action === "ban" || input.action === "unban") {
    if (target.id === user.id || isAdmin(target, env)) return json({ error: "You cannot ban your own owner account." }, 400);
    const banned = input.action === "ban";
    const statements = [env.DB.prepare(
      "INSERT INTO auth_account_controls (user_id,banned) VALUES(?1,?2) " +
      "ON CONFLICT(user_id) DO UPDATE SET banned=excluded.banned"
    ).bind(target.id,Number(banned))];
    if (banned) statements.push(env.DB.prepare("DELETE FROM auth_sessions WHERE user_id=?1").bind(target.id));
    statements.push(env.DB.prepare("INSERT INTO admin_account_actions(id,actor_id,target_id,action,at_ms) VALUES(?1,?2,?3,?4,?5)").bind(crypto.randomUUID(),user.id,target.id,input.action,Date.now()));
    await env.DB.batch(statements);
  } else {
    return json({ error: "Unknown account action." }, 400);
  }
  // Balance changes are applied atomically by admin_balance_apply, including balance_mode='set'.
  const account = await env.DB.prepare(accountColumns + "WHERE u.email=?1").bind(email).first();
  return json({ ok: true, account });
}
