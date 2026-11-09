import {useCallback,useEffect,useRef,useState} from "react";
import {Link,useSearchParams} from "react-router-dom";
import {useAuth} from "../components/AuthProvider";
import "./mines-battles.css";

type Tile="hidden"|"gem"|"mine"|"mine-hidden";
type Battle={
  id:string;host:string;guest:string|null;viewer:"host"|"guest"|"spectator";
  status:"waiting"|"active"|"finished"|"cancelled"|"expired";
  winner:"host"|"guest"|null;reason:string|null;hostScore:number;guestScore:number;
  hostBusted:boolean;guestBusted:boolean;createdAt:number;startedAt:number|null;endsAt:number;
  hostBoard:Tile[];guestBoard:Tile[]|null;canPlay:boolean;canJoin:boolean;
};
type RoomRow=Pick<Battle,"id"|"host"|"guest"|"viewer"|"status"|"hostScore"|"guestScore"|"winner"|"createdAt"|"endsAt">;
type ApiResult={room?:Battle;rooms?:RoomRow[];error?:string;ok?:boolean};
const API="/api/auth/mines-battles";
function timeLeft(end:number,now:number){
  const t=Math.max(0,Math.ceil((end-now)/1000));
  return Math.floor(t/60)+":"+String(t%60).padStart(2,"0");
}
function Status({status}:{status:Battle["status"]}){
 const labels={waiting:"Waiting",active:"Playing",finished:"Finished",expired:"Expired",cancelled:"Cancelled"};
 return <span className={"mb-status "+status}><i/>{labels[status]}</span>;
}
function Board({name,tiles,score,yours,canPick,busted,busy,onPick}:{
 name:string;tiles:Tile[]|null;score:number;yours:boolean;canPick:boolean;busted:boolean;busy:boolean;
 onPick:(tile:number)=>void;
}){
 return <section className={"mb-board-panel"+(yours?" yours":"")}>
   <header><div><small>{yours?"YOUR FIELD":"RIVAL FIELD"}</small><h3>{name}</h3></div>
     <div className="mb-board-score"><strong>{score}<span>/8</span></strong><small>SAFE PICKS</small></div>
   </header>
   <div className="mb-board-tiles" role="group" aria-label={name+" Mines board"}>
    {Array.from({length:25},(_,i)=>{
      const tile=tiles?.[i]||"hidden",hidden=tile==="hidden";
      return <button key={i} type="button" className={"mb-tile "+tile+(hidden&&canPick?" playable":"")}
        aria-label={"Tile "+(i+1)+": "+(hidden?"unrevealed":tile==="gem"?"gem":"mine")}
        disabled={!canPick||!hidden||busy} onClick={()=>onPick(i)}>
          {tile==="gem"?"◆":tile==="mine"?"💣":tile==="mine-hidden"?"✳":""}
        </button>;
    })}
   </div>
   <p className="mb-board-foot">{busted?"💥 Hit a mine":canPick?"Choose a covered tile":tiles?"5 hidden mines · 25 tiles":"Waiting for opponent"}</p>
 </section>;
}
export function MinesBattles(){
 const {isGuest,canSignIn,showSignIn}=useAuth();
 const [params,setParams]=useSearchParams();
 const roomId=params.get("room");
 const [room,setRoom]=useState<Battle|null>(null);
 const [rooms,setRooms]=useState<RoomRow[]>([]);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [now,setNow]=useState(Date.now());
 const [copied,setCopied]=useState(false);
 const inFlight=useRef(false);
 const generation=useRef(0);
 const refresh=useCallback(async()=>{
  if(isGuest||inFlight.current)return;
  inFlight.current=true;
  const token=++generation.current;
  try{
   const response=await fetch(API+(roomId?"?room="+encodeURIComponent(roomId):""),{cache:"no-store",credentials:"same-origin"});
   const result=await response.json() as ApiResult;
   if(!response.ok)throw new Error(result.error||"Mines Battles unavailable.");
   if(token!==generation.current)return;
   if(roomId)setRoom(result.room||null);else setRooms(result.rooms||[]);
   setLoading(false);setError("");
  }catch(e){if(token===generation.current){setLoading(false);setError(e instanceof Error?e.message:"Connection failed.");}}
  finally{inFlight.current=false;}
 },[isGuest,roomId]);
 useEffect(()=>{
  setRoom(null);setError("");setNotice("");setLoading(!isGuest);
  void refresh();
  const poll=window.setInterval(()=>{if(!document.hidden)void refresh();},2500);
  const focus=()=>void refresh();window.addEventListener("focus",focus);
  return()=>{clearInterval(poll);window.removeEventListener("focus",focus);generation.current++;};
 },[refresh,isGuest]);
 useEffect(()=>{const n=window.setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(n);},[]);
 async function act(payload:Record<string,unknown>){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch(API,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const result=await response.json() as ApiResult;
   if(!response.ok)throw new Error(result.error||"Could not complete battle action.");
   if(result.room){
    setRoom(result.room);
    if(result.room.id!==roomId)setParams({room:result.room.id});
   }
   if(payload.action==="create")setNotice("Battle created. Invite a player to join!");
   if(payload.action==="join")setNotice("You're in! Find eight safe gems first.");
   if(payload.action==="reveal"&&result.room?.status==="finished"){
    setNotice(result.room.winner===result.room.viewer?"You won the battle!":result.room.winner?"Battle finished.":"It's a draw!");
   }
   if(payload.action==="cancel")setNotice("Battle cancelled.");
  }catch(e){setError(e instanceof Error?e.message:"Could not reach the server.");}
  finally{setBusy(false);}
 }
 async function invite(){
  if(!room)return;
  try{
   await navigator.clipboard.writeText(window.location.origin+"/mines-battles?room="+encodeURIComponent(room.id));
   setCopied(true);window.setTimeout(()=>setCopied(false),2500);
  }catch{setError("Copying was blocked. You can copy the URL from your browser.");}
 }
 function openRoom(id:string){setParams({room:id});setCopied(false);}
 const waiting=rooms.filter(r=>r.status==="waiting");
 const playing=rooms.filter(r=>r.status==="active");
 const finished=rooms.filter(r=>r.status==="finished");
 const canPick=!!room?.canPlay&&room.status==="active"&&room.endsAt>now;
 const winnerName=room?.winner==="host"?room.host:room?.winner==="guest"?room.guest:null;
 return <main className="mb-page">
   <header className="mb-hero"><div>
    <p className="mb-kicker"><span className="mb-live-dot"/> BLOCKBET ORIGINALS · REAL MULTIPLAYER</p>
    <h1>Mines <em>Battles</em></h1><p>Two players. Two hidden minefields. First to uncover eight safe gems wins — hit a mine and you're out.</p>
    <div className="mb-tags"><span>25 TILES</span><span>5 MINES</span><span>8 GEMS TO WIN</span><span>FREE TO PLAY</span></div>
   </div><div className="mb-art" aria-hidden="true"><b>◆</b><span>✹</span></div></header>
   <nav className="mb-links">{roomId&&<button type="button" onClick={()=>setParams({})}>← All battles</button>}
     <Link to="/game/mines">Solo Mines ↗</Link></nav>
   {isGuest?<div className="mb-gate"><span>⚔</span><h2>Challenge another player</h2><p>Sign in to create, join or watch real-player Mines Battles. No bots and no wagers.</p>
     {canSignIn&&<button className="mb-primary" type="button" onClick={showSignIn}>Log in to battle</button>}</div>:
    <>
     {error&&<div className="mb-message error" role="alert">{error}<button onClick={()=>void refresh()}>Retry</button></div>}
     {notice&&<div className="mb-message success" role="status">{notice}</div>}
     {roomId?(loading&&!room?<p className="mb-loading">Loading battle…</p>:room?
       <div className="mb-game">
        <div className="mb-match-top"><div><Status status={room.status}/><h2>{room.status==="waiting"?"Waiting for a challenger":room.status==="active"?"Battle in progress":room.status==="finished"?"Battle results":"Battle closed"}</h2>
          <p>{room.status==="waiting"?"Share your link or wait for another signed-in player to join.":room.status==="active"?"Both players can uncover tiles at the same time.":room.status==="finished"?winnerName?winnerName+" won!":"It's a draw.":"This match is no longer open."}</p>
        </div><div className="mb-clock"><small>{room.status==="waiting"?"JOIN WINDOW":room.status==="active"?"TIME LEFT":"RESULT"}</small>
          <b>{room.status==="waiting"||room.status==="active"?timeLeft(room.endsAt,now):room.winner?"🏆":"—"}</b></div></div>
        {room.status==="finished"&&<div className={"mb-result "+(room.winner===room.viewer?"won":room.winner?"lost":"draw")} role="status">
          <strong>{room.winner===null?"DRAW":room.winner===room.viewer?"✦ YOU WON!":"BATTLE FINISHED"}</strong>
          <span>{winnerName?winnerName+" takes the win.":"Scores tied."} {room.reason==="timeout"?"The timer ran out.":room.reason==="mine"?"A mine was triggered.":""}</span></div>}
        <div className="mb-versus"><div><b>{room.host}</b><small>HOST · {room.hostScore}/8</small></div><span>VS</span>
          <div><b>{room.guest||"WAITING…"}</b><small>{room.guest?"CHALLENGER · "+room.guestScore+"/8":"NO OPPONENT YET"}</small></div></div>
        <div className="mb-boards">
          <Board name={room.host} tiles={room.hostBoard} score={room.hostScore} yours={room.viewer==="host"} canPick={canPick&&room.viewer==="host"} busted={room.hostBusted} busy={busy} onPick={tile=>void act({action:"reveal",id:room.id,tile})}/>
          <Board name={room.guest||"Waiting for challenger"} tiles={room.guestBoard} score={room.guestScore} yours={room.viewer==="guest"} canPick={canPick&&room.viewer==="guest"} busted={room.guestBusted} busy={busy} onPick={tile=>void act({action:"reveal",id:room.id,tile})}/>
        </div>
        <div className="mb-actions">
          {room.canJoin&&<button type="button" className="mb-primary" disabled={busy} onClick={()=>void act({action:"join",id:room.id})}>⚔ Join battle</button>}
          {room.status==="waiting"&&room.viewer==="host"&&<button type="button" className="mb-secondary" disabled={busy} onClick={()=>void act({action:"cancel",id:room.id})}>Cancel</button>}
          <button type="button" className="mb-secondary" onClick={()=>void invite()}>{copied?"✓ Link copied":"Copy invite link"}</button>
          {room.status==="finished"&&<button type="button" className="mb-primary" disabled={busy} onClick={()=>void act({action:"create"})}>New battle</button>}
          <button type="button" className="mb-secondary" onClick={()=>setParams({})}>Browse matches</button>
        </div><p className="mb-fine">Server-generated mines remain hidden until the battle ends. Free matches do not touch your Play USD balance.</p>
       </div>:<div className="mb-loading">Battle unavailable. <button onClick={()=>setParams({})}>Browse matches</button></div>):
       <div className="mb-browser">
         <section className="mb-create"><div><p>CREATE A ROOM</p><h2>Ready to battle?</h2><span>Open a match and share a link. Anyone with a BlockBet account can join.</span></div>
           <button type="button" disabled={busy} className="mb-primary" onClick={()=>void act({action:"create"})}>{busy?"Creating…":"＋ Create Mines Battle"}</button></section>
         <section className="mb-list"><header><h2><span className="mb-live-dot"/> Open battles</h2><small>Updates automatically</small></header>
           {loading?<div className="mb-empty">Connecting to players…</div>:waiting.length?waiting.map(r=><article className="mb-room" key={r.id}><span className="mb-room-icon">◆</span>
             <div><b>{r.host}</b><small>Waiting for challenger</small></div><Status status={r.status}/>
             <button className="mb-primary" onClick={()=>openRoom(r.id)}>{r.viewer==="host"?"Your room":"Join battle"}</button></article>):
             <div className="mb-empty"><b>No players waiting yet.</b><p>Create the first battle!</p></div>}
         </section>
         <section className="mb-list"><header><h2>Live matches</h2><small>Watch real matches</small></header>
           {playing.length?playing.map(r=><article className="mb-room" key={r.id}><span className="mb-room-icon">⚔</span>
             <div><b>{r.host} vs {r.guest}</b><small>{r.hostScore} – {r.guestScore} safe gems</small></div><Status status={r.status}/>
             <button className="mb-secondary" onClick={()=>openRoom(r.id)}>{r.viewer==="spectator"?"Spectate":"Return to battle"}</button></article>):
             <div className="mb-empty">No live matches right now.</div>}
         </section>
         <section className="mb-list"><header><h2>Recent results</h2><small>Completed matches</small></header>
           {finished.length?finished.slice(0,10).map(r=><article className="mb-room" key={r.id}><span className="mb-room-icon">🏆</span>
             <div><b>{r.host} vs {r.guest}</b><small>{r.hostScore} – {r.guestScore} · {r.winner==="host"?r.host:r.winner==="guest"?r.guest:"Draw"}</small></div>
             <button className="mb-secondary" onClick={()=>openRoom(r.id)}>View</button></article>):
             <div className="mb-empty">No completed matches yet.</div>}
         </section>
       </div>)}
    </>}
   <footer className="mb-footer">Mines Battles are free fictional-credit-free games. No bots, deposits, withdrawals or real-world prizes. All opponents are signed-in players.</footer>
 </main>;
}
