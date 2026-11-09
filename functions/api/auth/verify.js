import {
  json,dbReady,validEmail,sameOrigin,readBody,digest,sameHash,
  issueSession,hitRateLimit,PASSWORD_ITERATIONS
} from "../../_shared/auth.js";

// Six-digit email code is only usable to finish a password sign-up.
// It cannot bypass password login for an already registered account.
export async function onRequestPost({request,env}) {
  if(!sameOrigin(request)) return json({error:"Invalid request origin."},403);
  if(!(await dbReady(env))) return json({error:"Account service unavailable."},503);
  const input=await readBody(request);
  const email=validEmail(input?.email);
  const code=typeof input?.code==="string"?input.code.trim():"";
  if(!email || !/^\d{6}$/.test(code))
    return json({error:"Enter the six-digit code from your email."},400);
  const now=Date.now();
  try {
    const ip=request.headers.get("CF-Connecting-IP")||"unknown";
    const ipKey=await digest("ip:"+ip,env.AUTH_PEPPER);
    if(!(await hitRateLimit(env,"verify-ip:"+ipKey,3600000,40,now)))
      return json({error:"Too many verification attempts."},429);

    const pending=await env.DB.prepare(
      "SELECT password_hash,password_salt,password_iterations,expires_ms FROM auth_pending WHERE email=?1"
    ).bind(email).first();
    if(!pending || pending.expires_ms<now)
      return json({error:"Sign-up expired. Please sign up again."},401);
    const otp=await env.DB.prepare(
      "SELECT digest,expires_ms,attempts FROM auth_otp WHERE email=?1"
    ).bind(email).first();
    if(!otp || otp.expires_ms<now || otp.attempts>=5)
      return json({error:"Code expired or invalid. Request a new code."},401);
    const changed=await env.DB.prepare(
      "UPDATE auth_otp SET attempts=attempts+1 WHERE email=?1 AND digest=?2 AND attempts<5 AND expires_ms>?3"
    ).bind(email,otp.digest,now).run();
    if(changed.meta?.changes!==1)
      return json({error:"Code expired or invalid."},401);

    const candidate=await digest("otp:"+email+":"+code,env.AUTH_PEPPER);
    if(!sameHash(candidate,otp.digest))
      return json({error:"Incorrect code. Please try again."},401);

    const existing=await env.DB.prepare("SELECT id,password_hash FROM auth_users WHERE email=?1").bind(email).first();
    if(existing?.password_hash) return json({error:"This account already exists. Log in."},409);
    const consumed=await env.DB.prepare(
      "DELETE FROM auth_otp WHERE email=?1 AND digest=?2"
    ).bind(email,otp.digest).run();
    if(consumed.meta?.changes!==1) return json({error:"Code already used."},401);
    const saved=await env.DB.prepare(
      "INSERT INTO auth_users (id,email,created_ms,last_login_ms,password_hash,password_salt,password_iterations) " +
      "VALUES (?1,?2,?3,?3,?4,?5,?6) ON CONFLICT(email) DO UPDATE SET " +
      "password_hash=excluded.password_hash,password_salt=excluded.password_salt," +
      "password_iterations=excluded.password_iterations,last_login_ms=excluded.last_login_ms " +
      "WHERE auth_users.password_hash IS NULL"
    ).bind(crypto.randomUUID(),email,now,pending.password_hash,pending.password_salt,pending.password_iterations || PASSWORD_ITERATIONS).run();
    if(saved.meta?.changes!==1) return json({error:"Account already created. Log in."},409);
    await env.DB.prepare("DELETE FROM auth_pending WHERE email=?1").bind(email).run();
    const user=await env.DB.prepare("SELECT id,email FROM auth_users WHERE email=?1").bind(email).first();
    return issueSession(env,user,now);
  } catch(err) {
    console.error("verify error",err instanceof Error?err.name:"unexpected");
    return json({error:"Could not verify code. Please try again."},503);
  }
}
