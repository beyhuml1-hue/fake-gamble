import {useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {formatUSD} from "../lib/money";
import type {BetRecord} from "../state/wallet";
import "./home-spotlight.css";

type Leader={label:string;profitCents:number;bets:number};
type Feed={leaders?:Leader[];startAt?:number;resetAt?:number;source?:string};
type Page="leaderboard"|"stats";
const WEEK=7*24*3600000;

function weekBounds(now:number){
 const date=new Date(now);
 const offset=(date.getUTCDay()+6)%7;
 const start=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()-offset);
 return {start,reset:start+WEEK};
}
function remaining(end:number,now:number){
 const s=Math.max(0,Math.ceil((end-now)/1000));
 const days=Math.floor(s/86400),hours=Math.floor(s%86400/3600),minutes=Math.floor(s%3600/60);
 return days+"d  "+hours+"h  "+minutes+"m";
}
function compactMoney(cents:number){
 const n=cents/100;
 if(Math.abs(n)>=1e6)return (n/1e6).toFixed(2)+"M";
 if(Math.abs(n)>=1e3)return (n/1e3).toFixed(2)+"K";
 return formatUSD(cents);
}
export function HomeSpotlight({history}:{history:BetRecord[]}){
 const [active,setActive]=useState<Page>("leaderboard");
 const [now,setNow]=useState(Date.now());
 const [leaders,setLeaders]=useState<Leader[]>([]);
 const [loading,setLoading]=useState(true);
 const [offline,setOffline]=useState(false);

 useEffect(()=>{
  const cycle=window.setInterval(()=>setActive(s=>s==="leaderboard"?"stats":"leaderboard"),7500);
  const clock=window.setInterval(()=>setNow(Date.now()),15000);
  return()=>{window.clearInterval(cycle);window.clearInterval(clock);};
 },[]);
 useEffect(()=>{
  let disposed=false;
  async function load(){
   try{
    const response=await fetch("/api/auth/leaderboard",{cache:"no-store"});
    if(!response.ok)throw new Error("Offline");
    const data=await response.json() as Feed;
    if(disposed)return;
    setLeaders(Array.isArray(data.leaders)?data.leaders.filter(x=>
      typeof x.label==="string"&&Number.isSafeInteger(x.profitCents)&&x.profitCents>0
    ).slice(0,3):[]);
    setOffline(false);
   }catch{if(!disposed)setOffline(true);}
   finally{if(!disposed)setLoading(false);}
  }
  void load();
  const poll=window.setInterval(()=>{if(!document.hidden)void load();},90000);
  return()=>{disposed=true;clearInterval(poll);};
 },[]);
 const bounds=weekBounds(now);
 const stat=useMemo(()=>{
  const recent=history.filter(r=>r.at>=bounds.start&&r.at<bounds.reset);
  const wagered=recent.reduce((s,r)=>s+r.wager,0);
  const payout=recent.reduce((s,r)=>s+r.payout,0);
  const wins=recent.filter(x=>x.payout>x.wager).length;
  return {bets:recent.length,wagered,net:payout-wagered,winRate:recent.length?Math.round(wins/recent.length*100):0};
 },[history,bounds.start,bounds.reset]);
 return <section className="home-spotlight" aria-label="Weekly BlockBet results">
   <div className="home-spotlight-nav" role="tablist" aria-label="Homepage weekly panels">
      <button type="button" role="tab" aria-selected={active==="leaderboard"} className={active==="leaderboard"?"active":""} onClick={()=>setActive("leaderboard")}>🏆 Weekly leaderboard</button>
      <button type="button" role="tab" aria-selected={active==="stats"} className={active==="stats"?"active":""} onClick={()=>setActive("stats")}>Your stats</button>
   </div>
   <div className="home-spotlight-frame" role="tabpanel">
    <div className="home-spotlight-heading">
      <div><p>{active==="leaderboard"?"🏆 THIS WEEK'S TOP PLAYERS":"✦ YOUR WEEK IN PLAY USD"}</p>
        <small>{active==="leaderboard"?"Player-reported simulated profits · resets every Monday 00:00 UTC":"Your games on this device · resets every Monday 00:00 UTC"}</small>
      </div>
      <div className="home-spotlight-clock"><span>⏱</span><strong>{remaining(bounds.reset,now)}</strong><small>UNTIL RESET</small></div>
    </div>
    {active==="leaderboard"?<div className="home-leader-list">
      {loading?<div className="home-leader-empty">Loading community leaderboard…</div>:
       offline?<div className="home-leader-empty">Leaderboard is temporarily unavailable.</div>:
       leaders.length?leaders.map((row,index)=><div className="home-leader-row" key={row.label}>
         <span className={"home-medal rank-"+index}>{["🥇","🥈","🥉"][index]}</span>
         <span className="home-leader-avatar" aria-hidden="true">{row.label.slice(0,1).toUpperCase()}</span>
         <span className="home-leader-name">{row.label}<small>{row.bets} recorded bets</small></span>
         <b>+{compactMoney(row.profitCents)}</b>
       </div>):<div className="home-leader-empty">No reported winning players yet this week.</div>}
      <Link to="/stats" className="home-spotlight-bottom">See your play statistics</Link>
    </div>:<div className="home-stat-panel">
       <div className="home-stat-cards">
        <div><small>NET RESULT</small><strong className={stat.net>=0?"pos":"neg"}>{formatUSD(stat.net)}</strong></div>
        <div><small>TOTAL WAGERED</small><strong>{formatUSD(stat.wagered)}</strong></div>
        <div><small>BETS PLACED</small><strong>{stat.bets}</strong></div>
        <div><small>WIN RATE</small><strong>{stat.winRate}%</strong></div>
       </div>
       <Link to="/stats" className="home-spotlight-bottom">View detailed stats</Link>
     </div>}
   </div>
   <div className="home-spotlight-dots" aria-label="Select homepage panel">
     <button className={active==="leaderboard"?"on":""} aria-label="Show leaderboard" type="button" onClick={()=>setActive("leaderboard")}/>
     <button className={active==="stats"?"on":""} aria-label="Show your stats" type="button" onClick={()=>setActive("stats")}/>
   </div>
 </section>;
}
