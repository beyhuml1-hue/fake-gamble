import {configured,json,publicDisplayName} from "../../_shared/auth.js";

export async function onRequestGet({env,request}){
 if(!configured(env))return json({error:"Leaderboard unavailable."},503);
 const now=Date.now();
 const date=new Date(now);
 const day=(date.getUTCDay()+6)%7;
 const daily=new URL(request.url).searchParams.get('period')==='daily';
 const start=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()-(daily?0:day));
 const end=start+(daily?1:7)*24*3600000;
 try{
  const result=await env.DB.prepare(
   "SELECT u.email,SUM(b.payout-b.wager) AS profitCents,COUNT(*) AS bets "+
   "FROM auth_live_bets b JOIN auth_users u ON u.id=b.user_id WHERE b.at_ms>=?1 AND b.at_ms<?2 "+
   "GROUP BY b.user_id HAVING profitCents>0 "+
   "ORDER BY profitCents DESC,b.user_id ASC LIMIT ?3"
  ).bind(start,end,daily?20:3).all();
  return json({leaders:(result.results||[]).map(({email,...row})=>({...row,label:publicDisplayName(email)})),startAt:start,resetAt:end,
   source:"Player-submitted fictional-credit results; outcomes are not independently verified."});
 }catch{
  return json({error:"Leaderboard temporarily unavailable."},503);
 }
}
