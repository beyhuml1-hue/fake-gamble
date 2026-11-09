import {
  json, dbReady, validEmail, sameOrigin, readBody,
  digest, hitRateLimit, passwordHash, sameHash, issueSession, PASSWORD_ITERATIONS
} from "../../_shared/auth.js";

export async function onRequestPost({request,env}) {
  if (!sameOrigin(request)) return json({error:"Invalid request origin."},403);
  if (!(await dbReady(env))) return json({error:"Account service unavailable."},503);
  const input=await readBody(request);
  const email=validEmail(input?.email);
  const password=input?.password;
  if (!email || typeof password!=="string" || password.length>128 || password.length===0)
    return json({error:"Enter your email and password."},400);
  const now=Date.now();
  try {
    const ip=request.headers.get("CF-Connecting-IP") || "unknown";
    const ipHash=await digest("login-ip:"+ip,env.AUTH_PEPPER);
    const emailHash=await digest("login-email:"+email,env.AUTH_PEPPER);
    const a=await hitRateLimit(env,"login-ip:"+ipHash,15*60000,30,now);
    const b=await hitRateLimit(env,"login-email:"+emailHash,15*60000,10,now);
    if(!a||!b) return json({error:"Too many login attempts. Try again in 15 minutes."},429);

    const user=await env.DB.prepare(
      "SELECT id,email,password_hash,password_salt,password_iterations FROM auth_users WHERE email=?1"
    ).bind(email).first();
    // The fake hash prevents distinguishing known and unknown email addresses
    // by skipping the expensive password hashing operation.
    const salt=user?.password_salt || "00000000000000000000000000000000";
    const iterations=user?.password_iterations || PASSWORD_ITERATIONS;
    const hash=await passwordHash(password,salt,env.AUTH_PEPPER,iterations);
    if (!user?.password_hash || !sameHash(hash,user.password_hash))
      return json({error:"Incorrect email or password."},401);
    await env.DB.prepare("UPDATE auth_users SET last_login_ms=?1 WHERE id=?2").bind(now,user.id).run();
    return issueSession(env,user,now);
  } catch(err) {
    console.error("login error",err instanceof Error ? err.name : "unexpected");
    return json({error:"Login is temporarily unavailable. Please try again."},503);
  }
}
