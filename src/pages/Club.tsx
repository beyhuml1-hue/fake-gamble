import "./club.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../components/AuthProvider";
type Player={id:string;handle:string;avatar:string;banner?:string;xp?:number;online?:number};
type Profile=Player&{xp:number;points:number;equip:string};
type Duel={id:string;stake:number;side:"heads"|"tails";makerId:string;maker:string;makerAvatar:string;joinerId:string|null;joiner:string|null;outcome:"heads"|"tails"|null;winnerId:string|null;at:number;expiresAt:number};
type Prize={id:string;name:string;tier:string;chance:number};
type Friend=Player&{accepted:number;incoming:boolean};
type State={profile:Profile;people:Player[];boardWeek:(Player&{score:number})[];boardDay:(Player&{score:number})[];inventory:string[];prizes:Prize[];
duels:Duel[];jackpot:{round:number;endsAt:number;entrants:(Player&{stake:number})[];pot:number;previous:{winner:string;pot:number}|null};
friends:Friend[];party:{code:string;owner:string;expiresAt:number;members:Player[]}|null;
packs:{item:string;rarity:string;at:number}[];daily:{day:string;checked:boolean;missions:{id:string;name:string;done:boolean;claimed:boolean}[]};
tournament:{week:string;isWeekend:boolean;joined:boolean;standings:(Player&{score:number})[]}};
const AVATARS=["🪙","🦊","🐲","👑","💎","⚡","🐼","🚀","🎮","🌙","🔥","🦁"];
const BANNERS=["emerald","midnight","royal","sunset","ocean"];
const RARITY:Record<string,string>={Common:"#a5bbc5",Uncommon:"#65b5ff",Rare:"#b68aff",Legendary:"#ffcf69",Tournament:"#68e48a"};
function level(xp:number){return Math.floor(xp/150)+1;}
function points(n:number){return n.toLocaleString("en-GB")+" CP";}
function timer(end:number){const sec=Math.max(0,Math.ceil((end-Date.now())/1000));return Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0");}
function Tag({p}:{p:Player}){return <span className="club-user"><span>{p.avatar||"🪙"}</span><b>{p.handle}</b>{p.online?<i className="club-online" title="Recently active"/>:null}</span>;}
function Pane({kicker,title,children}:{kicker:string;title:string;children:ReactNode}){return <section className="club-pane"><header><small>{kicker}</small><h2>{title}</h2></header>{children}</section>;}
const api="/api/auth/club";

export function Club(){
 const {isGuest,showSignIn,canSignIn}=useAuth();
 const [data,setData]=useState<State|null>(null);
 const [tab,setTab]=useState("arena");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [offline,setOffline]=useState(false);
 const [now,setNow]=useState(Date.now());
 const [stake,setStake]=useState(50);
 const [side,setSide]=useState<"heads"|"tails">("heads");
 const [board,setBoard]=useState<"day"|"week">("week");
 const [handle,setHandle]=useState("");
 const [avatar,setAvatar]=useState("🪙");
 const [banner,setBanner]=useState("emerald");
 const [partyCode,setPartyCode]=useState("");
 const [drop,setDrop]=useState<Prize|null>(null);
 const [winner,setWinner]=useState<"win"|"loss"|null>(null);
 const currentUser=useRef("");
 const fetching=useRef(false);
 const fetchId=useRef(0);
 const refresh=useCallback(async()=>{
  if(isGuest||fetching.current)return;
  fetching.current=true;const id=++fetchId.current;
  try{
    const response=await fetch(api,{credentials:"same-origin",cache:"no-store"});
    if(!response.ok)throw new Error("Club offline");
    const state=await response.json() as State;
    if(id!==fetchId.current)return;
    setData(state);setOffline(false);
    if(currentUser.current!==state.profile.id){
      currentUser.current=state.profile.id;setHandle(state.profile.handle);
      setAvatar(state.profile.avatar);setBanner(state.profile.banner||"emerald");
    }
  }catch{if(id===fetchId.current)setOffline(true);}
  finally{fetching.current=false;}
 },[isGuest]);
 useEffect(()=>{if(isGuest)return;void refresh();const interval=window.setInterval(()=>{if(!document.hidden)void refresh();},5000);return()=>{window.clearInterval(interval);fetchId.current++;};},[refresh,isGuest]);
 useEffect(()=>{const i=window.setInterval(()=>setNow(Date.now()),500);return()=>window.clearInterval(i);},[]);
 async function act(payload:Record<string,unknown>){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{
    const response=await fetch(api,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)});
    const result=await response.json() as {error?:string;code?:string;drop?:{item:string;rarity:string};won?:boolean;outcome?:string};
    if(!response.ok)throw new Error(result.error||"Action failed.");
    if(payload.action==="pack"&&result.drop){
      const item=data?.prizes.find(p=>p.id===result.drop?.item);
      if(item){setDrop(item);setNotice("Unlocked "+item.name+"!");}
    }else if(payload.action==="duel-join"){
      setWinner(result.won?"win":"loss");
      window.setTimeout(()=>setWinner(null),3000);
      setNotice("Coin landed "+String(result.outcome||"?").toUpperCase()+". "+(result.won?"You won!":"Better luck next time."));
    }else if(payload.action==="party-create"&&result.code){setNotice("Party created. Invite code: "+result.code);}
    else setNotice("Updated successfully.");
    await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Please retry.");}
  finally{setBusy(false);}
 }
 const self=data?.profile;
 const friends=useMemo(()=>new Set((data?.friends||[]).map(f=>f.id)),[data?.friends]);
 const jackpot=data?.jackpot;
 const gradient=useMemo(()=>{
  if(!jackpot?.entrants.length)return "conic-gradient(#29404e,#29404e)";
  const colors=["#00e701","#4ca5ef","#ffc254","#ab83ed","#47cdba","#ef789f"];
  let n=0;return "conic-gradient("+jackpot.entrants.map((e,i)=>{const a=n;n+=e.stake/jackpot.pot*100;return colors[i%colors.length]+" "+a+"% "+n+"%";}).join(",")+")";
 },[jackpot]);
 if(isGuest)return <main className="club-main"><div className="club-cover"><h1>Play together. Stand out.</h1><p>Sign in to join real players, complete missions and collect cosmetics with fictional Club Points.</p>{canSignIn&&<button className="bet-btn" onClick={showSignIn}>Log in to Club</button>}</div></main>;
 return <main className="club-main">
  <section className={"club-cover club-banner-"+(self?.banner||"emerald")}>
    <div><span className="club-kicker">✦ BLOCKBET CLUB · COMMUNITY</span><h1>Play together.<br/><em>Stand out.</em></h1><p>Compete, collect cosmetics and earn XP. No real money or invented opponents.</p>
    <div className="club-stats"><span><b>{self?.avatar} {self?.handle||"Player"}</b><small>Level {level(self?.xp||0)}</small></span><span><b>{points(self?.points||0)}</b><small>Club Points</small></span><span><b>{self?.xp||0} XP</b><small>Experience</small></span></div>
    </div><div className="club-hero-symbol" aria-hidden="true">✦</div>
  </section>
  <nav className="club-tabs" aria-label="Club areas">{([["arena","⚔ Arena"],["profile","♛ Profile"],["collect","◆ Collect"],["friends","♧ Friends"],["events","★ Events"]] as const).map(([id,label])=><button key={id} type="button" className={tab===id?"active":""} aria-current={tab===id?"page":undefined} onClick={()=>setTab(id)}>{label}</button>)}</nav>
  {offline&&<p role="status" className="club-alert">Club temporarily offline. Retrying…</p>}
  {error&&<p role="alert" className="club-alert bad">{error}</p>}
  {notice&&<p role="status" className="club-alert good">{notice}</p>}
  {!data&&<div className="club-wait">{offline?"Unable to load Club. Refresh to retry.":"Connecting to your Club profile…"}</div>}
  {data&&<>
   {tab==="arena"&&<div className="club-grid">
     <Pane kicker="EVERY TWO MINUTES" title="Community Jackpot">
       <div className="club-jackpot"><div className="club-wheel" style={{background:gradient}} aria-label={"Jackpot pool "+points(jackpot?.pot||0)}><div className="club-wheel-core"><small>LIVE POT</small><b>{points(jackpot?.pot||0)}</b><span>{jackpot?.entrants.length||0} players</span></div></div>
       <div className="club-jackpot-controls"><span className="club-timer">Next draw · {timer(jackpot?.endsAt||now)}</span><p>Server picks a random winning entry. The larger your contribution, the greater your chance.</p>
       <div className="club-stakes">{[20,50,100,200].map(v=><button key={v} type="button" className={stake===v?"active":""} onClick={()=>setStake(v)}>{v} CP</button>)}</div>
       <button className="bet-btn" type="button" disabled={busy||(jackpot?.entrants||[]).some(p=>p.id===self?.id)} onClick={()=>void act({action:"jackpot-join",round:jackpot?.round,stake})}>{(jackpot?.entrants||[]).some(p=>p.id===self?.id)?"Joined ✓":"Join jackpot"}</button>
       {jackpot?.previous&&<p className="club-prev">Last winner: <b>{jackpot.previous.winner}</b> · {points(jackpot.previous.pot)}</p>}
       </div></div><div className="club-chips">{jackpot?.entrants.map(p=><span key={p.id}>{p.avatar} {p.handle} · {points(p.stake)}</span>)}{!jackpot?.entrants.length&&<p>No entries yet. Be first!</p>}</div>
     </Pane>
     <Pane kicker="SERVER FLIPS · LIVE ROOMS" title="1v1 Coinflip Battles">
       <p className="club-copy">Create a heads-or-tails challenge. Someone else joins for the same Club Points entry. Friends can spectate the result here.</p>
       <div className="club-create-duel"><div className="club-stakes"><button type="button" className={side==="heads"?"active":""} onClick={()=>setSide("heads")}>HEADS</button><button type="button" className={side==="tails"?"active":""} onClick={()=>setSide("tails")}>TAILS</button></div>
        <select aria-label="Battle entry" value={stake} onChange={e=>setStake(Number(e.target.value))}>{[20,50,100,200].map(v=><option key={v} value={v}>{points(v)}</option>)}</select>
        <button className="bet-btn" type="button" disabled={busy} onClick={()=>void act({action:"duel-create",id:crypto.randomUUID(),stake,side})}>Create battle</button>
       </div>
       <h3>Open challenges</h3><div className="club-rooms">{data.duels.filter(d=>!d.joinerId&&d.expiresAt>now).map(d=><div className="club-room" key={d.id}><Tag p={{id:d.makerId,handle:d.maker,avatar:d.makerAvatar}}/><div><b>{d.side.toUpperCase()}</b><small>{points(d.stake)} each</small></div>
         {d.makerId===self?.id?<button className="club-secondary" disabled={busy} onClick={()=>void act({action:"duel-cancel",id:d.id})}>Cancel</button>:<button className="bet-btn" disabled={busy} onClick={()=>void act({action:"duel-join",id:d.id})}>Join</button>}</div>)}{!data.duels.some(d=>!d.joinerId&&d.expiresAt>now)&&<p className="club-empty">No live challenges. Create the first battle.</p>}</div>
       <h3>Spectator results</h3><div className="club-rooms">{data.duels.filter(d=>d.joinerId).slice(0,10).map(d=><div className="club-room settled" key={d.id}><Tag p={{id:d.makerId,handle:d.maker,avatar:d.makerAvatar}}/><span className="club-result-coin">{d.outcome==="heads"?"H":"T"}</span><div><b>{d.outcome?.toUpperCase()}</b><small>{points(d.stake*2)} won by {d.winnerId===d.makerId?d.maker:d.joiner}</small></div></div>)}{!data.duels.some(d=>d.joinerId)&&<p className="club-empty">Completed battles appear here for spectators.</p>}</div>
     </Pane>
     {winner&&<div className={"club-win-toast "+winner} role="status">{winner==="win"?"✦ YOU WON!":"BATTLE FINISHED"}<small>{winner==="win"?"2× Club Points payout":"Try another battle"}</small></div>}
   </div>}
   {tab==="profile"&&<div className="club-grid">
     <Pane kicker="YOUR IDENTITY" title="Customise your profile"><div className={"club-profile-preview club-banner-"+banner}><span>{avatar}</span><h3>{handle}</h3><small>Level {level(self?.xp||0)} · {self?.xp} XP · {self?.equip==="classic"?"Classic look":data.prizes.find(p=>p.id===self?.equip)?.name}</small><div className="club-progress"><i style={{width:((self?.xp||0)%150)/150*100+"%"}}/></div></div>
      <form className="club-form" onSubmit={e=>{e.preventDefault();void act({action:"profile",handle,avatar,banner});}}><label>Player name<input value={handle} onChange={e=>setHandle(e.target.value)} minLength={3} maxLength={18} required/></label><strong>Avatar</strong>
       <div className="club-avatars">{AVATARS.map(a=><button type="button" aria-label={"Choose "+a} key={a} className={avatar===a?"active":""} onClick={()=>setAvatar(a)}>{a}</button>)}</div><strong>Banner colour</strong>
       <div className="club-banners">{BANNERS.map(b=><button type="button" key={b} aria-label={"Choose "+b} className={"club-banner-"+b+(banner===b?" active":"")} onClick={()=>setBanner(b)}>{b}</button>)}</div><button className="bet-btn" type="submit" disabled={busy}>Save profile</button></form>
     </Pane>
     <Pane kicker="EARN YOUR BADGES" title="Achievements"><div className="club-achievements">{[
      {icon:"🌱",name:"New Challenger",done:true,help:"Join Club"},
      {icon:"⭐",name:"Rising Star",done:(self?.xp||0)>=150,help:"Earn 150 XP"},
      {icon:"💎",name:"Veteran",done:(self?.xp||0)>=900,help:"Earn 900 XP"},
      {icon:"🎁",name:"Collector",done:data.inventory.length>=3,help:"Unlock 3 cosmetics"},
      {icon:"🤝",name:"Connected",done:data.friends.some(f=>f.accepted),help:"Add a friend"},
      {icon:"👑",name:"Weekend Champion",done:data.inventory.includes("champion-frame"),help:"Win a weekend tournament"}
      ].map(b=><div className={b.done?"club-achievement earned":"club-achievement"} key={b.name}><span>{b.icon}</span><div><b>{b.name}</b><small>{b.help}</small></div><b>{b.done?"✓":"🔒"}</b></div>)}</div>
     </Pane>
     <Pane kicker="REAL XP FROM CLUB ACTIVITY" title="Player leaderboards"><div className="club-stakes"><button className={board==="day"?"active":""} type="button" onClick={()=>setBoard("day")}>Today</button><button className={board==="week"?"active":""} type="button" onClick={()=>setBoard("week")}>Last 7 days</button></div>
       {(board==="day"?data.boardDay:data.boardWeek).map((p,i)=><div className="club-board-row" key={p.id}><span>#{i+1}</span><Tag p={p}/><b>{p.score} XP</b></div>)}
       {!(board==="day"?data.boardDay:data.boardWeek).length&&<p className="club-empty">No XP earned this period.</p>}
     </Pane>
   </div>}
   {tab==="collect"&&<div className="club-grid">
     <Pane kicker="80 CLUB POINTS · NO REAL MONEY" title="Cosmetic Cases"><div className={"club-pack"+(drop?" revealed":"")}><span>{drop?"✦":"🎁"}</span><h3>{drop?drop.name:"The BlockBet Vault"}</h3><p>{drop?drop.tier.toUpperCase()+" DROP UNLOCKED":"Open packs to unlock exclusive cosmetic cards, frames and coins."}</p>
       <button className="bet-btn" disabled={busy} onClick={()=>void act({action:"pack",id:crypto.randomUUID()})}>{busy?"Opening…":"Open pack · 80 CP"}</button></div>
       <h3>Published chances</h3><div className="club-odds">{Object.entries({Common:70,Uncommon:25,Rare:4,Legendary:1}).map(([tier,p])=><div key={tier}><span style={{color:RARITY[tier]}}>{tier}</span><b>{p}%</b><div className="club-odds-bar"><i style={{width:p+"%",background:RARITY[tier]}}/></div></div>)}</div><p className="club-fine">Duplicates still award XP. Cosmetics are not tradable or redeemable for cash.</p>
     </Pane>
     <Pane kicker="EQUIP YOUR FAVOURITE" title={"Cosmetic inventory · "+data.inventory.length}><div className="club-inventory"><button className={"club-item"+(self?.equip==="classic"?" equipped":"")} disabled={busy} onClick={()=>void act({action:"equip",item:"classic"})}><span>🪙</span><b>Classic</b><small>{self?.equip==="classic"?"Equipped":"Equip"}</small></button>
      {data.prizes.map(p=><button key={p.id} disabled={busy||!data.inventory.includes(p.id)} className={"club-item"+(self?.equip===p.id?" equipped":"")} onClick={()=>void act({action:"equip",item:p.id})}><span>{p.id.includes("coin")?"🪙":p.id.includes("dice")?"🎲":p.id.includes("banner")?"🌌":"👑"}</span><b>{p.name}</b><small style={{color:RARITY[p.tier]}}>{data.inventory.includes(p.id)?self?.equip===p.id?"Equipped":p.tier:"Locked · "+p.tier}</small></button>)}</div>
     </Pane>
     <Pane kicker="YOUR RECENT DROPS" title="Unboxing history">{data.packs.map((p,i)=><div className="club-board-row" key={i}><span style={{color:RARITY[p.rarity]}}>{p.rarity}</span><b>{data.prizes.find(x=>x.id===p.item)?.name||p.item}</b><small>{new Date(p.at).toLocaleDateString()}</small></div>)}{!data.packs.length&&<p className="club-empty">No packs opened yet.</p>}</Pane>
   </div>}
   {tab==="friends"&&<div className="club-grid">
     <Pane kicker="BUILD YOUR CREW" title="Friends">{data.friends.map(f=><div className="club-board-row" key={f.id}><Tag p={f}/><span>{f.accepted?"✓ Friends":f.incoming?"Incoming":"Pending"}</span><div className="club-buttons">{f.incoming&&!f.accepted&&<button className="bet-btn" disabled={busy} onClick={()=>void act({action:"friend-accept",target:f.id})}>Accept</button>}<button className="club-secondary" disabled={busy} onClick={()=>void act({action:"friend-remove",target:f.id})}>Remove</button></div></div>)}{!data.friends.length&&<p className="club-empty">No friends yet. Find someone below.</p>}</Pane>
     <Pane kicker="REAL REGISTERED USERS" title="Find players">{data.people.filter(p=>p.id!==self?.id).slice(0,28).map(p=><div className="club-board-row" key={p.id}><Tag p={p}/><span>Lv {level(p.xp||0)}</span><button className="club-secondary" disabled={busy||friends.has(p.id)} onClick={()=>void act({action:"friend-request",target:p.id})}>{friends.has(p.id)?"Requested":"Add friend"}</button></div>)}{data.people.length<=1&&<p className="club-empty">No other profiles yet. Invite a friend!</p>}</Pane>
     <Pane kicker="UP TO 4 PLAYERS" title="Private parties"><p className="club-copy">Create a temporary party and share the invite code. See your friend's presence and party roster.</p>
      {data.party?<div className="club-party"><h3>Party · {data.party.code}</h3><p>Leader: {data.party.owner}</p>{data.party.members.map(p=><div key={p.id}><Tag p={p}/></div>)}<button className="club-secondary" disabled={busy} onClick={()=>void act({action:"party-leave"})}>Leave party</button></div>
       :<div className="club-party"><button className="bet-btn" disabled={busy} onClick={()=>void act({action:"party-create"})}>Create party</button><label>Join with code<input maxLength={8} placeholder="Invite code" value={partyCode} onChange={e=>setPartyCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,""))}/></label><button className="club-secondary" disabled={busy||partyCode.length!==8} onClick={()=>void act({action:"party-join",code:partyCode})}>Join party</button></div>}
     </Pane>
   </div>}
   {tab==="events"&&<div className="club-grid">
     <Pane kicker="RESETS AT 00:00 UTC" title="Daily Missions"><div className="club-daily"><div><b>🎁 Daily check-in</b><p>+120 CP and +25 XP</p></div><button className="bet-btn" disabled={busy||data.daily.checked} onClick={()=>void act({action:"checkin"})}>{data.daily.checked?"Claimed ✓":"Claim reward"}</button></div>
       {data.daily.missions.map(m=><div className="club-mission" key={m.id}><span>{m.id==="pack"?"🎁":m.id==="duel"?"⚔":"🪙"}</span><div><b>{m.name}</b><small>+70 CP · +30 XP</small></div><button disabled={busy||!m.done||m.claimed} className={m.done&&!m.claimed?"bet-btn":"club-secondary"} onClick={()=>void act({action:"claim-mission",mission:m.id})}>{m.claimed?"Claimed":m.done?"Claim":"Locked"}</button></div>)}
     </Pane>
     <Pane kicker="SATURDAY–SUNDAY UTC" title="Weekend Tournament"><div className="club-tournament"><span>🏆</span><div><h3>Weekend Championship</h3><p>Free entry, equal starting score. A server-settled duel win gives 3 points; a jackpot win gives 5. Champion earns an exclusive cosmetic frame.</p></div></div>
       <button className="bet-btn club-tournament-join" disabled={busy||!data.tournament.isWeekend||data.tournament.joined} onClick={()=>void act({action:"tournament-join"})}>{data.tournament.joined?"Entered ✓":data.tournament.isWeekend?"Enter free":"Opens Saturday 00:00 UTC"}</button>
       <h3>Leaderboard</h3>{data.tournament.standings.map((p,i)=><div key={p.id} className="club-board-row"><span>#{i+1}</span><Tag p={p}/><b>{p.score} pts</b></div>)}{!data.tournament.standings.length&&<p className="club-empty">No entries yet this weekend.</p>}
     </Pane>
     <Pane kicker="EXPLORE AND UNLOCK" title="Season goals">{[["Level 5",600],["Level 10",1350],["Level 20",2850]] .map(([name,need])=><div className="club-goal" key={name}><b>{name}</b><div className="club-progress"><i style={{width:Math.min(100,(self?.xp||0)/Number(need)*100)+"%"}}/></div><small>{self?.xp||0} / {need} XP</small></div>)}</Pane>
   </div>}
  </>}
  <footer className="club-footer">Club Points and cosmetic items are fictional, non-withdrawable and have no cash value. The casino's Play USD wallet is separate. All opponents are real signed-in players.</footer>
 </main>;
}
