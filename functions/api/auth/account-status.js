import {configured,digest,json,sessionToken} from "../../_shared/auth.js";
export async function onRequestGet({request,env}){
 if(!configured(env))return json({error:"Unavailable."},503);
 const token=sessionToken(request);
 if(!token)return json({status:"guest"});
 const hash=await digest("session:"+token,env.AUTH_PEPPER);
 const row=await env.DB.prepare("SELECT u.email,COALESCE(c.banned,0) AS banned,COALESCE(c.paused,0) AS paused "+
  "FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id LEFT JOIN auth_account_controls c ON c.user_id=u.id "+
  "WHERE s.digest=?1 AND s.expires_ms>?2").bind(hash,Date.now()).first();
 if(!row)return json({status:"guest"});
 return json({status:row.banned?"banned":row.paused?"paused":"active"});
}
