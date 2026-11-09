import {
  json, dbReady, emailReady, validEmail, validPassword, sameOrigin, readBody,
  randomSalt, passwordHash, PASSWORD_ITERATIONS, digest, hitRateLimit
} from "../../_shared/auth.js";
import { sendCode } from "./request.js";

// New accounts require password setup AND ownership of the email address.
// No account is created until the six-digit email code is verified.
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({error:"Invalid request origin."},403);
  if (!(await dbReady(env))) return json({error:"Account service unavailable."},503);
  if (!emailReady(env)) return json({error:"Email verification is not configured."},503);
  const input = await readBody(request);
  const email = validEmail(input?.email);
  if (!email || !validPassword(input?.password))
    return json({error:"Enter a valid email and a password of 12–128 characters."},400);
  const now=Date.now();
  try {
    const ip=request.headers.get("CF-Connecting-IP") || "unknown";
    const ipHash=await digest("signup-ip:"+ip,env.AUTH_PEPPER);
    const emailHash=await digest("signup-email:"+email,env.AUTH_PEPPER);
    const a=await hitRateLimit(env,"signup-ip:"+ipHash,3600000,15,now);
    const b=await hitRateLimit(env,"signup-email:"+emailHash,3600000,6,now);
    if (!a||!b) return json({error:"Too many sign-up attempts. Try again later."},429);
    const prior=await env.DB.prepare("SELECT password_hash FROM auth_users WHERE email=?1").bind(email).first();
    if (prior?.password_hash)
      return json({error:"This email already has an account. Please log in."},409);

    const salt=randomSalt();
    const hash=await passwordHash(input.password,salt,env.AUTH_PEPPER);
    await env.DB.prepare(
      "INSERT INTO auth_pending (email,password_hash,password_salt,password_iterations,created_ms,expires_ms) " +
      "VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(email) DO UPDATE SET " +
      "password_hash=excluded.password_hash,password_salt=excluded.password_salt," +
      "password_iterations=excluded.password_iterations,created_ms=excluded.created_ms,expires_ms=excluded.expires_ms"
    ).bind(email,hash,salt,PASSWORD_ITERATIONS,now,now+30*60000).run();
    return await sendCode(email,request,env);
  } catch (err) {
    console.error("signup error",err instanceof Error ? err.name : "unexpected");
    return json({error:"Couldn't start sign-up. Please try again."},503);
  }
}
