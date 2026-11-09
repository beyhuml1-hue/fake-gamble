import { configured, currentUser, isAdmin, json, readBody, sameOrigin, validEmail } from "../../_shared/auth.js";

async function authorize({ request, env }) {
  if (!configured(env)) return json({ error: "Account service unavailable." }, 503);
  const user = await currentUser(request, env);
  return isAdmin(user, env) ? null : json({ error: "Owner access required." }, 403);
}

const accountQuery =
  "SELECT u.email, COALESCE(c.banned, 0) AS banned, c.balance_cents AS balanceCents " +
  "FROM auth_users u LEFT JOIN auth_account_controls c ON c.user_id = u.id WHERE u.email = ?1";

export async function onRequestGet(context) {
  const denied = await authorize(context);
  if (denied) return denied;
  const email = validEmail(new URL(context.request.url).searchParams.get("email"));
  if (!email) return json({ error: "Enter an account email." }, 400);
  const account = await context.env.DB.prepare(accountQuery).bind(email).first();
  return account ? json({ account }) : json({ error: "Account not found." }, 404);
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
    if (!Number.isInteger(cents) || cents < 0 || cents > 100_000_000) {
      return json({ error: "Enter an amount from $0.00 to $1,000,000.00." }, 400);
    }
    await env.DB.prepare(
      "INSERT INTO auth_account_controls (user_id, balance_cents, balance_revision, balance_mode) VALUES (?1, ?2, ?3, 'set') " +
      "ON CONFLICT(user_id) DO UPDATE SET balance_cents = excluded.balance_cents, balance_revision = excluded.balance_revision, balance_mode = 'set'"
    ).bind(target.id, cents, crypto.randomUUID()).run();
  } else if (input.action === "ban" || input.action === "unban") {
    if (isAdmin(target, env)) return json({ error: "The owner account cannot be banned." }, 400);
    const banned = input.action === "ban";
    const statements = [env.DB.prepare(
      "INSERT INTO auth_account_controls (user_id, banned) VALUES (?1, ?2) " +
      "ON CONFLICT(user_id) DO UPDATE SET banned = excluded.banned"
    ).bind(target.id, Number(banned))];
    if (banned) statements.push(env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?1").bind(target.id));
    await env.DB.batch(statements);
  } else {
    return json({ error: "Unknown account action." }, 400);
  }
  return json({ account: await env.DB.prepare(accountQuery).bind(email).first() });
}
