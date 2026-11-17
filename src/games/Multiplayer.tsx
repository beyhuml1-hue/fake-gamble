import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { useAuth } from "../components/AuthProvider";
import { formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";
import {sound} from "../lib/sound";
import "./uno-matches.css";
import "./multiplayer.css";
import "./pool-uno.css";

type Game = "pool" | "connect-four" | "mines-battles" | "uno";
type UnoCard={id:number;color:string;value:string};
type Ball = {id:number;x:number;y:number;sunk:boolean};
type State = {hand?:UnoCard[];top?:UnoCard;color?:string;hostCount?:number;guestCount?:number;drawn?:{host:number;guest:number};balls?:Ball[];shots?:number;pocketed?:number;board?:number[];
  revealed?:number[];mines?:number[];hostScore?:number;guestScore?:number;last?:number};
type Room = {
  id:string;game:Game;stakeCents:number;status:"waiting"|"active"|"finished"|"cancelled"|"expired";
  host:string;guest:string|null;role:"host"|"guest"|null;
  myTurn:boolean;turn:"host"|"guest"|null;winner:"host"|"guest"|null;
  result:string|null;createdMs:number;state:State;version:number
};
type Payload={open?:Room[];mine?:Room|null;match?:Room;error?:string};

const names:Record<Game,string>={"pool":"8-Ball Pool","connect-four":"Connect Four","mines-battles":"Mines Duel","uno":"Uno"};
async function request(path:string,body?:object):Promise<Payload>{
  const response=await fetch("/api/auth/matches"+path,{
    method:body?"POST":"GET",
    credentials:"same-origin",cache:"no-store",
    headers:body?{"Content-Type":"application/json"}:{},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const payload=await response.json() as Payload;
  if(!response.ok)throw new Error(payload.error||"Multiplayer service unavailable.");
  return payload;
}

export function Multiplayer({game}:{game:Game}){
  const {email,showSignIn}=useAuth();
  const {balance,walletReady,syncSocialWallet}=useWallet();
  const [amount,setAmount]=useState(1);
  const [rooms,setRooms]=useState<Room[]>([]);
  const [mine,setMine]=useState<Room|null>(null);
  const [match,setMatch]=useState<Room|null>(null);
  const [roomId,setRoomId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const pending=useRef(false);
  const idRef=useRef(roomId);
  idRef.current=roomId;

  const refresh=useCallback(async()=>{
    if(!email)return;
    try{
      const data=await request("?game="+encodeURIComponent(game));
      setRooms(data.open||[]);
      setMine(data.mine||null);
      const id=idRef.current|| (data.mine?.game===game?data.mine.id:null);
      if(id){
        const detail=await request("?id="+encodeURIComponent(id));
        if(detail.match){setMatch(detail.match);if(!idRef.current)setRoomId(id);}
      }
    }catch(e){
      setError(e instanceof Error?e.message:"Unable to load open matches.");
    }
  },[email,game]);


  const act=async(action:"create"|"join"|"move"|"leave",extra:object)=>{
    if(pending.current)return;
    pending.current=true;
    setBusy(true);setError("");
    try{
      const reply=await request("",{action,...extra});
      if(reply.match){setMatch(reply.match);setRoomId(reply.match.id);}
      syncSocialWallet();
      void refresh();
    }catch(e){
      setError(e instanceof Error?e.message:"Could not update the match.");
      void refresh();
    }finally{pending.current=false;setBusy(false);}
  };
  const current=match?.game===game?match:null;
  const working=current&&["waiting","active"].includes(current.status);
  const otherGame=mine&&mine.game!==game&&["waiting","active"].includes(mine.status);
  const canCreate=Boolean(email&&walletReady&&!busy&&!working&&!otherGame);
  const waiting=rooms.filter(room=>room.status==="waiting");
  const live=Boolean(working);

  useEffect(()=>{
    void refresh();
    const handle=window.setInterval(()=>{if(!document.hidden)void refresh();},live?800:2500);
    return()=>window.clearInterval(handle);
  },[refresh,live]);

  return <GameLayout title={names[game]} note="Player vs player · play-money stakes" panel={
    <div className="pvp-controls">
      {!email?<div className="room-setup">
        <p>Sign in to create a match and play against another player.</p>
        <button className="bet-btn" type="button" onClick={showSignIn}>Sign in to play</button>
      </div>:working?<div className="room-setup">
        <p className="field-label">{current.status==="waiting"?"Waiting for opponent":"Match in progress"}</p>
        <strong className="pvp-stake">{formatUSD(current.stakeCents)} each</strong>
        <p>{current.host} vs {current.guest??"Waiting for a challenger"}</p>
        {current.status==="waiting"&&<p className="hint">Your match is visible to anyone who opens {names[game]}. Your stake is reserved until someone joins or you cancel.</p>}
        {current.status==="active"&&<p className="hint">{current.myTurn?"Your turn.":"Opponent's turn. You can leave this page and return."}</p>}
        <button type="button" className="ghost-btn" disabled={busy}
          onClick={()=>{if(window.confirm(current.status==="waiting"?"Cancel and refund your waiting stake?":"Forfeit the match to your opponent?"))
            void act("leave",{id:current.id});}}>
          {current.status==="waiting"?"Cancel waiting match":"Forfeit match"}
        </button>
      </div>:<BetPanel amount={amount} onAmount={setAmount} profitCents={Math.round(amount*100)}
        label={busy?"Creating…":"Create match"} onAction={()=>void act("create",{game,stakeCents:Math.round(amount*100)})}
        error={error} disabled={!canCreate}>
        <p className="hint">Another player stakes the same amount. Winner takes both stakes; a draw refunds both. No house edge.</p>
        {otherGame&&<p className="form-error">Finish your <Link to={"/game/"+mine.game}>{names[mine.game]}</Link> match first.</p>}
        {!walletReady&&<p className="hint">Syncing your play-money balance…</p>}
      </BetPanel>}
      {working&&error&&<p role="alert" className="form-error">{error}</p>}
      {!working&&<p className="hint">Available: {formatUSD(balance)}</p>}
    </div>
  }>
    {!email?<div className="pvp-empty"><h2>Open matches</h2><p>Sign in to see who is waiting and challenge them.</p></div>:
    current?.status==="active"?<div className="pvp-match">
      <div className="pvp-versus">
        <span>{current.host}</span><strong>VS</strong><span>{current.guest}</span>
      </div>
      <p className="pvp-turn" role="status">{current.myTurn?"Your turn":(current.turn==="host"?current.host:current.guest)+" is playing"} · Pot {formatUSD(current.stakeCents*2)}</p>
      {game==="uno"?<UnoMatch room={current} busy={busy} play={move=>void act("move",{id:current.id,move})}/>:game==="pool"?<PoolMatch room={current} busy={busy} shoot={move=>void act("move",{id:current.id,move})}/>:
        game==="connect-four"?<FourMatch room={current} busy={busy} move={column=>void act("move",{id:current.id,move:{column}})}/>:
        <MinesMatch room={current} busy={busy} move={tile=>void act("move",{id:current.id,move:{tile}})}/>}
      <p className="hint">Moves are verified on the server. Refreshing or changing pages will not reset the match.</p>
    </div>:
    current&&["finished","expired","cancelled"].includes(current.status)?<div className="pvp-empty">
      <h2>{current.status==="cancelled"?"Match cancelled":current.winner===null?"Draw":current.winner===current.role?"You won!":"Opponent won"}</h2>
      <p>{current.result??"Match finished."}</p>
      <strong>{current.winner===current.role?formatUSD(current.stakeCents*2):current.winner===null?formatUSD(current.stakeCents)+" refunded":"No payout"}</strong>
      <button type="button" className="bet-btn" onClick={()=>{idRef.current=null;setMatch(null);setRoomId(null);void refresh();}}>Back to open matches</button>
    </div>:
    <div className="pvp-lobby">
      <div className="pvp-list-head"><h2>Waiting to play</h2><button className="ghost-btn" type="button" onClick={()=>void refresh()}>Refresh</button></div>
      {waiting.length===0?<div className="pvp-empty"><p>No players waiting yet. Create a match to appear here.</p></div>:
        <div className="pvp-room-list">{waiting.map(room=><div className="pvp-room" key={room.id}>
          <div><strong>{room.host}</strong><small>Waiting for opponent</small></div>
          <b>{formatUSD(room.stakeCents)}</b>
          <button className="bet-btn" type="button" disabled={busy||!walletReady||balance<room.stakeCents||Boolean(otherGame)||Boolean(working)||room.role==="host"}
            onClick={()=>void act("join",{id:room.id})}>{room.role==="host"?"Your room":"Play against"}</button>
        </div>)}</div>}
    </div>}
  </GameLayout>;
}

const tableColors=["#f8f4df","#FFD64A","#3186ea","#f85845","#a95de2","#fb9f45","#4bcc92","#8d302e","#171918"];
const pockets:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[
  [0,0],[350,0],[700,0],[0,350],[350,350],[700,350]
];
function PoolMatch({room,busy,shoot}:{room:Room;busy:boolean;shoot:(move:{type:"shoot";x:number;y:number;power:number})=>void}){
  const [aim,setAim]=useState({x:480,y:175});
  const [power,setPower]=useState(65);
  const balls=room.state.balls??[];
  const cue=balls.find(ball=>ball.id===0);
  const playable=room.myTurn&&!busy&&Boolean(cue);
  return <>
    <svg className="pool-table pvp-pool" viewBox="-35 -35 770 420" role="img" aria-label="Pool table. Tap to aim a shot."
      onPointerDown={event=>{
        if(!playable)return;
        const transform=event.currentTarget.getScreenCTM()?.inverse();
        if(!transform)return;
        const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(transform);
        setAim({x:Math.max(0,Math.min(700,point.x)),y:Math.max(0,Math.min(350,point.y))});
      }}>
      <defs>
        <linearGradient id="room-wood" x2=".25" y2="1"><stop stopColor="#9b6339"/><stop offset=".3" stopColor="#412718"/><stop offset=".65" stopColor="#825333"/><stop offset="1" stopColor="#492a1c"/></linearGradient>
        <radialGradient id="room-felt"><stop stopColor="#179656"/><stop offset="1" stopColor="#07532e"/></radialGradient>
        <radialGradient id="room-ball" cx=".3" cy=".2" r=".8"><stop stopColor="#fff" stopOpacity=".8"/><stop offset=".3" stopColor="#fff" stopOpacity=".1"/><stop offset=".6" stopColor="#000" stopOpacity="0"/><stop offset="1" stopColor="#000" stopOpacity=".6"/></radialGradient>
        <pattern id="room-grain" width="70" height="8" patternUnits="userSpaceOnUse"><path d="M0 2Q32 -1 70 3M0 6Q40 10 70 5" stroke="#241408" strokeWidth=".5" opacity=".5" fill="none"/></pattern>
        <pattern id="room-cloth" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0h4M0 2h4" stroke="#d4ffe9" strokeOpacity=".04"/></pattern>
      </defs>
      <rect x="-32" y="-32" width="764" height="414" rx="25" fill="url(#room-wood)" stroke="#b49a67" strokeWidth="2"/>
      <rect x="-31" y="-31" width="762" height="412" rx="24" fill="url(#room-grain)"/>
      <rect x="-10" y="-10" width="720" height="370" rx="14" fill="#103c24" stroke="#24965b" strokeWidth="6"/>
      <rect width="700" height="350" rx="9" fill="url(#room-felt)"/>
      <rect width="700" height="350" rx="9" fill="url(#room-cloth)"/>
      {[85,175,265,435,525,615].flatMap(x=>[-22,372].map(y=><path key={x+"/"+y} d={`M${x} ${y-4}l3 4-3 4-3-4z`} fill="#eedaa9"/>))}
      {[87,175,263].flatMap(y=>[-22,722].map(x=><path key={x+"/"+y} d={`M${x} ${y-4}l3 4-3 4-3-4z`} fill="#eedaa9"/>))}

      {pockets.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={18} fill="#030807" stroke="#625f42" strokeWidth="2"/>)}
      {cue&&playable&&<line x1={cue.x} y1={cue.y} x2={aim.x} y2={aim.y} stroke="#f6f8db" strokeDasharray="6 7"/>}
      {cue&&playable&&<g transform={`translate(${cue.x} ${cue.y}) rotate(${Math.atan2(aim.y-cue.y,aim.x-cue.x)*180/Math.PI})`}>
        <path d="M-190 -3L-23 -1L-23 1L-190 3Z" fill="#dec08b" stroke="#674f29"/>
        <path d="M-190 -3v6l65-1v-4Z" fill="#6c3523"/>
      </g>}
      {balls.filter(ball=>!ball.sunk).map(ball=><g key={ball.id} className="pvp-ball">
        <ellipse cx={ball.x+2} cy={ball.y+3} rx="12" ry="9" fill="#00180a" opacity=".4"/>
        <circle cx={ball.x} cy={ball.y} r={11} stroke="#1d2e29" strokeWidth={1.2}
          fill={tableColors[ball.id>8?ball.id-8:ball.id]}/>
        {ball.id>8&&<rect x={ball.x-9} y={ball.y-5} width="18" height="10" rx="4" fill="#fff8e5"/>}
        {ball.id!==0&&<><circle cx={ball.x} cy={ball.y} r={7} fill="#fff4df"/>
          <text x={ball.x} y={ball.y+3} textAnchor="middle" fill="#18221d" fontSize={8}>{ball.id}</text></>}
      <circle cx={ball.x} cy={ball.y} r="11" fill="url(#room-ball)"/>
      </g>)}
    </svg>
    <p role="status">{room.state.pocketed??0} pocketed · {room.state.shots??0} shots</p>
    <div className="arcade-moves pvp-shot-controls">
      <label>Power <input type="range" min={15} max={100} value={power} disabled={!playable}
        onChange={e=>setPower(Number(e.target.value))}/></label>
      <button className="bet-btn" type="button" disabled={!playable}
        onClick={()=>shoot({type:"shoot",x:aim.x,y:aim.y,power})}>Shoot</button>
    </div>
    <p className="hint">Aim by tapping the table. Take turns; pocket the eight ball last to win.</p>
  </>;
}
function FourMatch({room,busy,move}:{room:Room;busy:boolean;move:(column:number)=>void}){
  const board=room.state.board||Array(42).fill(0);
  return <>
    <div className="connect-choices">{Array.from({length:7},(_,i)=>
      <button type="button" className="ghost-btn" key={i} aria-label={"Drop in column "+(i+1)}
        disabled={!room.myTurn||busy||Boolean(board[i])} onClick={()=>move(i)}>↓</button>)}</div>
    <div className="connect-board" aria-label="Shared Connect Four board">
      {board.map((disc,i)=><span key={i} data-disc={disc} aria-label={disc===1?"Host disc":disc===2?"Challenger disc":"Empty"}/>)}
    </div>
    <p className="hint">Host uses gold discs. Challenger uses the other colour.</p>
  </>;
}
function MinesMatch({room,busy,move}:{room:Room;busy:boolean;move:(tile:number)=>void}){
  const shown=room.state.revealed||[];
  const hiddenMines=room.state.mines||[];
  return <>
    <p className="pvp-turn">Safe gems · {room.host}: {room.state.hostScore||0} · {room.guest}: {room.state.guestScore||0}</p>
    <div className="mb-board" aria-label="Shared Mines Duel board">
      {Array.from({length:25},(_,tile)=>{
        const revealed=shown.includes(tile),bomb=hiddenMines.includes(tile);
        return <button key={tile} type="button" className={"mb-tile"+(revealed?" safe":"")+(bomb?" bomb":"")+(tile===room.state.last&&revealed?" just":"")}
          disabled={!room.myTurn||busy||revealed} aria-label={"Tile "+(tile+1)+(revealed?", opened":"")}
          onClick={()=>move(tile)}>
          {revealed?<img src="/images/gem-green.webp" alt="Gem"/>:<span className="mb-tile-shine"/>}
        </button>;
      })}
    </div>
    <p className="hint">Take turns opening tiles. Hit a mine and the other player wins.</p>
  </>;
}



function UnoMatch({room,busy,play}:{room:Room;busy:boolean;play:(move:{type:"play";cardId:number;color:string})=>void}){
 const [color,setColor]=useState("red");const [chosen,setChosen]=useState<UnoCard|null>(null);
 const state=room.state,hand=state.hand||[],top=state.top;
 const previous=useRef(room.version);
 useEffect(()=>{if(previous.current!==room.version){sound.flip();previous.current=room.version;setChosen(null);}},[room.version]);
 const legal=(card:UnoCard)=>card.value==="wild4"?!hand.some(c=>c.color===state.color):card.color==="wild"||card.color===state.color||card.value===top?.value;
 const label=(card:UnoCard)=>({skip:"⊘",reverse:"⇄",draw2:"+2",wild:"✦",wild4:"+4"}[card.value]||card.value);
 const count=room.role==="host"?state.guestCount:state.hostCount;
 return <div className="uno-table">
  <div className="uno-opponent" aria-label={"Opponent has "+count+" cards"}>{Array.from({length:Math.min(count||0,20)},(_,i)=><span className="uno-back" key={i}>UNO</span>)}<b>{count} cards</b></div>
  <div className="uno-centre"><div className="uno-back uno-deck">UNO</div>{top&&<div className="uno-playing-card uno-discard" key={room.version} data-color={top.color}><small>{label(top)}</small><b>{label(top)}</b><small>{label(top)}</small></div>}</div>
  <p role="status">Current colour: <strong>{state.color}</strong> · {room.myTurn?"Play a highlighted card":"Waiting for your opponent"}</p>
  {!!state.drawn?.[room.role||"host"]&&<p className="uno-draw-notice">Automatically drew {state.drawn[room.role||"host"]} card(s).</p>}
  <div className="uno-hand">{hand.map(card=><button type="button" key={card.id} className="uno-playing-card" data-color={card.color} disabled={busy||!room.myTurn||!legal(card)} aria-label={card.color+" "+card.value} onClick={()=>{sound.flip();if(card.color==="wild")setChosen(card);else play({type:"play",cardId:card.id,color:card.color});}}><small>{label(card)}</small><b>{label(card)}</b><small>{label(card)}</small></button>)}</div>
  {hand.length===1&&<strong className="uno-call">UNO!</strong>}
  {chosen&&<div className="uno-color-picker"><p>Choose the next colour</p>{["red","yellow","green","blue"].map(c=><button type="button" key={c} data-color={c} aria-pressed={color===c} onClick={()=>{setColor(c);play({type:"play",cardId:chosen.id,color:c});}} disabled={busy}>{c}</button>)}</div>}
  <p className="hint">No draw button: a card is drawn automatically only when no legal play is available. If it cannot be played, your turn passes. Skip, Reverse, +2 and Wild cards supported.</p>
 </div>;
}
