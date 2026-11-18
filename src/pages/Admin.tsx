import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../components/AuthProvider";
import { formatUSD } from "../lib/money";
import "./admin-dashboard.css";

type Account={email:string;balanceCents:number|null;banned:0|1;paused:0|1;online:boolean;seenMs:number|null;page:string|null;lastLoginMs:number;activeGame:string|null;luckMode?:"normal"|"hot"|"cold"};
type Action="balance"|"ban"|"unban"|"pause"|"unpause"|"luck";
type DemoCard={number:string;expiry:string;code:string;remainingCents:number;demoOnly:true};
export function Admin(){
 const {isAdmin}=useAuth();
 const [password,setPassword]=useState(""),[unlocked,setUnlocked]=useState(false),[accounts,setAccounts]=useState<Account[]>([]);
 const [query,setQuery]=useState(""),[selected,setSelected]=useState(""),[amount,setAmount]=useState(""),[card,setCard]=useState<DemoCard|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const player=accounts.find(a=>a.email===selected);
 const filtered=useMemo(()=>accounts.filter(a=>a.email.toLowerCase().includes(query.toLowerCase())),[query,accounts]);
 const api=useCallback(async(path:string,body?:object)=>{
  const r=await fetch("/api/auth/admin"+path,{method:body?"POST":"GET",cache:"no-store",headers:{"X-Blockbet-Admin-Key":password,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const d=await r.json();if(!r.ok)throw new Error(d.error||"Admin service unavailable");return d;
 },[password]);
 const refresh=useCallback(async()=>{
  const d=await api("?list=1");
  setAccounts(d.accounts||[]);
  setCard(d.demoCard||null);
 },[api]);
 useEffect(()=>{
  if(!unlocked)return;
  const timer=window.setInterval(()=>{if(!document.hidden)void refresh().catch(()=>{});},5000);
  return()=>window.clearInterval(timer);
 },[refresh,unlocked]);
 async function unlock(e:FormEvent){e.preventDefault();setBusy(true);setError("");
  try{await refresh();setUnlocked(true);}catch(err){setError(err instanceof Error?err.message:"Unable to unlock");}finally{setBusy(false);}
 }
 async function change(action:Action,more:Record<string,unknown>={}){
  if(!player||busy)return;
  if(action==="ban"&&!window.confirm("Ban "+player.email+"?"))return;
  setBusy(true);setError("");setNotice("");
  try{await api("",{action,email:player.email,...more});await refresh();setNotice("Account updated.");}
  catch(err){setError(err instanceof Error?err.message:"Unable to save");}
  finally{setBusy(false);}
 }
 if(!isAdmin)return <section className="admin-page"><h1>Owner access required</h1><p>Sign in to your owner account to open /admin.</p></section>;
 if(!unlocked)return <section className="admin-page admin-lock">
  <h1>BlockBet Admin</h1><p>Owner sign-in and a separate admin password are required.</p>
  <form className="admin-form" onSubmit={unlock}>
   <label htmlFor="admin-password">Admin password</label><input type="password" id="admin-password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="off" required/>
   <button className="bet-btn" disabled={busy||!password}>Unlock panel</button>
  </form>{error&&<p className="neg" role="alert">{error}</p>}</section>;
 return <section className="admin-page admin-dashboard">
  <header className="admin-dashboard-head"><div><small>BLOCKBET CONTROL CENTER</small><h1>Admin dashboard</h1><p>Play money · live account activity</p></div><button type="button" className="ghost-btn" onClick={()=>{setUnlocked(false);setPassword("");setCard(null);}}>Lock</button></header>
  <div className="admin-summary"><div><small>Accounts shown</small><strong>{accounts.length}</strong></div><div><small>Online now</small><strong>{accounts.filter(a=>a.online).length}</strong></div><div><small>Active multiplayer</small><strong>{accounts.filter(a=>a.activeGame).length}</strong></div></div>
  {error&&<p className="neg" role="alert">{error}</p>}{notice&&<p className="pos" role="status">{notice}</p>}
  <div className="admin-workspace">
   <section className="admin-players"><div className="admin-panel-title"><h2>Players</h2><button type="button" className="ghost-btn" onClick={()=>void refresh().catch(e=>setError(String(e)))}>Refresh</button></div>
    <input type="search" aria-label="Find player" placeholder="Search by email…" value={query} onChange={e=>setQuery(e.target.value)}/>
    <div className="admin-player-list">{filtered.map(a=><button type="button" className={"admin-player"+(selected===a.email?" selected":"")} key={a.email} onClick={()=>{setSelected(a.email);setAmount(a.balanceCents===null?"":(a.balanceCents/100).toFixed(2));}}>
      <span className={"admin-presence"+(a.online?" active":"")}/><span className="admin-player-name"><strong>{a.email}</strong><small>{a.banned?"Banned":a.paused?"Paused":a.online?"Online":"Offline"}{a.activeGame?" · "+a.activeGame:""}</small></span><b>{a.balanceCents===null?"—":formatUSD(a.balanceCents)}</b>
     </button>)}{!filtered.length&&<p>No players match.</p>}</div>
   </section>
   <section className="admin-detail">{player?<><header><h2>{player.email}</h2><p>{player.banned?"Banned":player.paused?"Paused":player.online?"● Online":"Offline"}</p></header>
    <div className="admin-stat-grid"><div><small>Live wallet</small><strong>{player.balanceCents===null?"Uninitialized":formatUSD(player.balanceCents)}</strong></div><div><small>Current game</small><strong>{player.activeGame||player.page||"Not playing"}</strong></div><div><small>Last seen</small><strong>{player.seenMs?new Date(player.seenMs).toLocaleString():"Unknown"}</strong></div><div><small>Last login</small><strong>{player.lastLoginMs?new Date(player.lastLoginMs).toLocaleString():"Unknown"}</strong></div></div>
    <form className="admin-form" onSubmit={e=>{e.preventDefault();if(!/^\d+(\.\d{1,2})?$/.test(amount)){setError("Enter a valid amount.");return;}const cents=Math.round(Number(amount)*100);if(!Number.isSafeInteger(cents)||cents>10_000_000_000){setError("Maximum $100 million.");return;}void change("balance",{cents});}}>
     <label htmlFor="admin-balance">Set Play USD balance</label><div className="admin-inline"><input id="admin-balance" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/><button className="bet-btn" disabled={busy}>Save</button></div>
    </form><div className="admin-actions"><button type="button" className="ghost-btn" disabled={busy} onClick={()=>void change(player.paused?"unpause":"pause")}>{player.paused?"Resume account":"Pause account"}</button>
    <button type="button" className="ghost-btn" disabled={busy} onClick={()=>void change(player.banned?"unban":"ban")}>{player.banned?"Unban account":"Ban account"}</button></div>
    <div className="admin-luck"><h3>Simulation odds</h3><p>Only for play-money test matches. Adjusted odds are labelled in-game.</p><div role="group" aria-label="Simulation luck">
    {(["normal","hot","cold"] as const).map(mode=><button type="button" key={mode} className={player.luckMode===mode?"selected":""} disabled={busy} onClick={()=>void change("luck",{mode})}>{mode==="hot"?"Hot table":mode==="cold"?"Cold table":"Normal"}</button>)}</div></div>
    </>:<div className="admin-empty"><h2>Select a player</h2><p>View online status, live balance, current game and account controls.</p></div>}</section>
  </div>
  <section className="admin-card-area"><div><h2>Internal demo card</h2><p>Not a bank card. These details work only with the Play USD test-voucher form on this site.</p>
   {card?<div className="admin-demo-card"><span>BLOCKBET • DEMO</span><strong>{card.number}</strong><div><span>Expiry {card.expiry}</span><span>Code {card.code}</span></div></div>:<p>Demo card unavailable.</p>}</div>
   <div className="admin-card-balance"><small>Remaining shared test funds</small><strong>{card?formatUSD(card.remainingCents):"—"}</strong><p>Credits are deducted from the shared $125 test card when redeemed.</p></div>
  </section>
 </section>;
}
