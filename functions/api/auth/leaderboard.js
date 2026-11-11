import {configured,json} from "../../_shared/auth.js";

export async function onRequestGet({env}){
 if(!configured(env))return json({error:"Leaderboard unavailable."},503);
 const now=Date.now();
 const date=new Date(now);
 const day=(date.getUTCDay()+6)%7;
 const start=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()-day);
 const end=start+7*24*3600000;
 try{
  const result=await env.DB.prepare(
   "SELECT label,SUM(payout-wager) AS profitCents,COUNT(*) AS bets "+
   "FROM auth_live_bets WHERE at_ms>=?1 AND at_ms<?2 "+
   "GROUP BY user_id HAVING profitCents>0 "+
   "ORDER BY profitCents DESC,label ASC LIMIT 3"
  ).bind(start,end).all();
  return json({leaders:result.results||[],startAt:start,resetAt:end,
   source:"Player-submitted fictional-credit results; outcomes are not independently verified."});
 }catch{
  return json({error:"Leaderboard temporarily unavailable."},503);
 }
}
