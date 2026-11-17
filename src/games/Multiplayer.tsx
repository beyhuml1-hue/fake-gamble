import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { useAuth } from "../components/AuthProvider";
import { formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";
import "./multiplayer.css";

type Game = "pool" | "connect-four" | "mines-battles";
type Ball = {id:number;x:number;y:number;sunk:boolean};
type State = {balls?:Ball[];shots?:number;pocketed?:number;board?:number[];
  revealed?:number[];mines?:number[];hostScore?:number;guestScore?:number;last?:number};
type Room = {
  id:string;game:Game;stakeCents:number;status:"waiting"|"active"|"finished"|"cancelled"|"expired";
  host:string;guest:string|null;role:"host"|"guest"|null;
  myTurn:boolean;turn:"host"|"guest"|null;winner:"host"|"guest"|null;
  result:string|null;createdMs:number;state:State;version:number
};
type Payload={open?:Room[];mine?:Room|null;match?:Room;error?:string};

const names:Record<Game,string>={"pool":"8-Ball Pool","connect-four":"Connect Four","mines-battles":"Mines Duel"};
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

  useEffect(()=>{
    void refresh();
    const handle=window.setInterval(()=>{if(!document.hidden)void refresh();},2500);
    return()=>window.clearInterval(handle);
  },[refresh]);

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
      {game==="pool"?<PoolMatch room={current} busy={busy} shoot={move=>void act("move",{id:current.id,move})}/>:
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
    <svg className="pool-table pvp-pool" viewBox="-14 -14 728 378" role="img" aria-label="Pool table. Tap to aim a shot."
      onPointerDown={event=>{
        if(!playable)return;
        const transform=event.currentTarget.getScreenCTM()?.inverse();
        if(!transform)return;
        const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(transform);
        setAim({x:Math.max(0,Math.min(700,point.x)),y:Math.max(0,Math.min(350,point.y))});
      }}>
      <rect x={0} y={0} width={700} height={350} rx={12} fill="#176048"/>
      {pockets.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={18} fill="#0c1917"/>)}
      {cue&&playable&&<line x1={cue.x} y1={cue.y} x2={aim.x} y2={aim.y} stroke="#f6f8db" strokeDasharray="6 7"/>}
      {balls.filter(ball=>!ball.sunk).map(ball=><g key={ball.id} className="pvp-ball">
        <circle cx={ball.x} cy={ball.y} r={11} stroke="#1d2e29" strokeWidth={1.2}
          fill={tableColors[ball.id>8?ball.id-8:ball.id]}/>
        {ball.id!==0&&<><circle cx={ball.x} cy={ball.y} r={7} fill="#fff4df"/>
          <text x={ball.x} y={ball.y+3} textAnchor="middle" fill="#18221d" fontSize={8}>{ball.id}</text></>}
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
        return <button key={tile} type="button" className={"mb-tile"+(revealed?" safe":"")+(bomb?" bomb":"")}
          disabled={!room.myTurn||busy||revealed} aria-label={"Tile "+(tile+1)+(revealed?", opened":"")}
          onClick={()=>move(tile)}>
          {revealed?<img src="/images/gem-green.webp" alt="Gem"/>:<span className="mb-tile-shine"/>}
        </button>;
      })}
    </div>
    <p className="hint">Take turns opening tiles. Hit a mine and the other player wins.</p>
  </>;
}
