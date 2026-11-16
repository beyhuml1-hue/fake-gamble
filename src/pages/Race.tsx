import { useEffect, useState } from "react";
import { formatUSD } from "../lib/money";

type Leader = {label: string; profitCents: number; bets: number};
type RaceFeed = {leaders: Leader[]; resetAt: number};

export function Race(){
  const [feed,setFeed]=useState<RaceFeed|null>(null);
  const [offline,setOffline]=useState(false);
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{
    let active=true;
    async function refresh(){
      try{
        const response=await fetch("/api/auth/leaderboard?period=daily",{cache:"no-store"});
        if(!response.ok)throw new Error("Race unavailable");
        const data=await response.json() as RaceFeed;
        if(!Array.isArray(data.leaders)||!Number.isFinite(data.resetAt))throw new Error("Invalid Race feed");
        if(active){setFeed(data);setOffline(false);}
      }catch{if(active)setOffline(true);}
    }
    void refresh();
    const poll=window.setInterval(refresh,20000);
    const clock=window.setInterval(()=>setNow(Date.now()),1000);
    return ()=>{active=false;window.clearInterval(poll);window.clearInterval(clock);};
  },[]);
  const secs=Math.max(0,Math.ceil(((feed?.resetAt??now)-now)/1000));
  const clock=[Math.floor(secs/3600),Math.floor(secs%3600/60),secs%60].map(n=>String(n).padStart(2,"0")).join(":");
  const leaders=secs?feed?.leaders??[]:[];
  return <section className="arcade-race">
    <header className="arcade-hero-card">
      <div><p className="arcade-kicker">Daily leaderboard</p><h1>Race</h1>
        <p>Ranked by net Play USD profit from today's reported games.</p></div>
      <div><small>RESETS AT 00:00 UTC</small><strong className="race-clock">{feed?clock:"--:--:--"}</strong></div>
    </header>
    <div className="race-results">
      <h2>Standings</h2>
      {offline&&<p role="status">Race feed is temporarily unavailable.</p>}
      {!offline&&!feed&&<p role="status">Loading standings…</p>}
      {feed&&!leaders.length&&<p>{secs?"No positive results reported today.":"Today's standings are resetting."}</p>}
      <ol>{leaders.map((row,index)=><li key={row.label+index}><span>{row.label}<small>{row.bets} plays</small></span><strong>{formatUSD(row.profitCents)}</strong></li>)}</ol>
    </div>
  </section>;
}
