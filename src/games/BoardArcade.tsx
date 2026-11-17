import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { betCents, formatUSD, payout } from "../lib/money";
import { useWallet } from "../state/wallet";
import { Chess, type Square } from "chess.js";
import { GameLayout } from "../components/GameLayout";
import { randInt, shuffle } from "../lib/random";
import { Pool } from "./Pool";
import { Multiplayer } from "./Multiplayer";

const discs = Array<number>(42).fill(0);
function drop(board: number[], column: number, player: number) {
  const next = [...board];
  for (let row=5;row>=0;row--) {
    const index = row * 7 + column;
    if (!next[index]) { next[index] = player; return next; }
  }
  return null;
}
function connect(board: number[], player: number) {
  return board.some((disc,index) => {
    if (disc !== player) return false;
    const x=index%7, y=Math.floor(index/7);
    return [[1,0],[0,1],[1,1],[-1,1]].some(([dx,dy]) =>
      [1,2,3].every(distance=>{
        const col=x+dx!*distance,row=y+dy!*distance;
        return col>=0 && col<7 && row<6 && board[row*7+col]===player;
      }));
  });
}
function ConnectFour(){
  const [board,setBoard]=useState(discs);
  const [result,setResult]=useState("");
  function move(col:number){
    const next=drop(board,col,1);
    if (!next || result) return;
    if(connect(next,1)){setBoard(next);setResult("You connected four.");return;}
    const available=[3,2,4,1,5,0,6].filter(i=>!next[i]);
    if(!available.length){setBoard(next);setResult("Draw.");return;}
    const ai=available.find(i=>connect(drop(next,i,2)!,2)) ?? available.find(i=>connect(drop(next,i,1)!,1)) ?? available[0]!;
    const reply=drop(next,ai,2)!;
    setBoard(reply);
    if(connect(reply,2))setResult("Rival connected four.");
    else if(reply.every(Boolean))setResult("Draw.");
  }
  return <>
    <div className="connect-choices">{Array.from({length:7},(_,i)=><button type="button" className="ghost-btn" key={i} disabled={Boolean(result)||Boolean(board[i])} aria-label={"Drop in column "+(i+1)} onClick={()=>move(i)}>↓</button>)}</div>
    <div className="connect-board" aria-label="Connect Four board">{board.map((disc,i)=><span aria-label={disc===1?"Your disc":disc===2?"Rival disc":"Empty"} data-disc={disc} key={i}/>)}</div>
    <p role="status">{result||"Your turn · gold discs"}</p>
    <button type="button" className="ghost-btn" onClick={()=>{setBoard(discs);setResult("");}}>New game</button>
  </>;
}

type BoardOutcome = "win" | "loss" | "draw";
type BoardProps = { onFinish: (result: BoardOutcome) => void; locked: boolean };

const glyph:Record<string,string>={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
const value:Record<string,number>={p:1,n:3,b:3,r:5,q:9,k:0};
function ChessBoard({onFinish,locked}:BoardProps){
  const [movesPlayed,setMovesPlayed]=useState<string[]>([]);
  const [from,setFrom]=useState<Square|null>(null);
  const [promotion,setPromotion]=useState<"q"|"r"|"b"|"n">("q");
  const board=new Chess();
  movesPlayed.forEach(move=>board.move(move));
  const possible=from?board.moves({square:from,verbose:true}):[];
  const ended=board.isGameOver();
  useEffect(()=>{
    if(ended) onFinish(board.isCheckmate() ? (board.turn()==="w"?"loss":"win") : "draw");
  },[ended,movesPlayed]);
  useEffect(()=>{
    const current=new Chess();
    movesPlayed.forEach(move=>current.move(move));
    if(locked||current.turn()!=="b"||current.isGameOver())return;
    const timer=window.setTimeout(()=>{
      const moves=shuffle(current.moves({verbose:true}));
      moves.sort((a,b)=>(value[b.captured??""]??0)-(value[a.captured??""]??0));
      setMovesPlayed([...movesPlayed,moves[0]!.san]);
    },400);
    return ()=>window.clearTimeout(timer);
  },[movesPlayed,locked]);
  function move(square:Square){
    if(locked||ended||board.turn()!=="w")return;
    const legal=possible.find(option=>option.to===square && (!option.promotion||option.promotion===promotion));
    if(legal){setMovesPlayed([...movesPlayed,legal.san]);setFrom(null);return;}
    setFrom(board.get(square)?.color==="w"?square:null);
  }
  return <>
    <div className="arcade-chess">{board.board().flatMap((row,r)=>row.map((piece,c)=>{
      const square=("abcdefgh"[c]+String(8-r)) as Square;
      return <button type="button" key={square} disabled={locked} aria-label={square+(piece?" "+piece.color+piece.type:"")} aria-pressed={from===square}
        data-dark={(r+c)%2===1} data-legal={possible.some(option=>option.to===square)} onClick={()=>move(square)}>
        {piece ? glyph[piece.color+piece.type] : ""}
      </button>;
    }))}</div>
    <p role="status">{board.isCheckmate()?(board.turn()==="w"?"Checkmate · rival wins":"Checkmate · you win"):ended?"Draw":board.turn()==="w"?board.inCheck()?"White to move · check":"White to move":"Rival thinking…"}</p>
    <label>Promote to <select disabled={locked} value={promotion} onChange={event=>setPromotion(event.target.value as typeof promotion)}>
      <option value="q">Queen</option><option value="r">Rook</option><option value="b">Bishop</option><option value="n">Knight</option>
    </select></label>
  </>;
}
const colors=["Red","Green","Blue","Gold"];
type Card={color:number;rank:number;id:number};
function unoDeck(){
  return shuffle(Array.from({length:76},(_,id)=>({id,color:Math.floor(id/19),rank:id%19===0?0:Math.ceil((id%19)/2)})));
}
function unoStart(){
  const deck=unoDeck();
  return {deck:deck.slice(15),you:deck.slice(0,7),bot:deck.slice(7,14),pile:[deck[14]!],result:"",turns:0};
}
function usable(card:Card,top:Card){return card.color===top.color||card.rank===top.rank;}
function Uno({onFinish,locked}:BoardProps){
  const [state,setState]=useState(unoStart);
  useEffect(()=>{
    if(state.result) onFinish(state.result==="Draw."?"draw":state.result.startsWith("You ")?"win":"loss");
  },[state.result]);
  function turn(card?:Card){
    if(locked||state.result)return;
    const next={...state,deck:[...state.deck],you:[...state.you],bot:[...state.bot],pile:[...state.pile],turns:state.turns+1};
    function take(){
      if(!next.deck.length&&next.pile.length>1){const top=next.pile.pop()!;next.deck=shuffle(next.pile);next.pile=[top];}
      return next.deck.pop();
    }
    if(card){next.you=next.you.filter(item=>item.id!==card.id);next.pile.push(card);}
    else {const picked=take();if(picked)next.you.push(picked);}
    if(!next.you.length){next.result="You emptied your hand.";setState(next);return;}
    const valid=next.bot.filter(item=>usable(item,next.pile.at(-1)!));
    const response=valid[randInt(valid.length)];
    if(response){next.bot=next.bot.filter(item=>item.id!==response.id);next.pile.push(response);}
    else{const picked=take();if(picked)next.bot.push(picked);}
    if(!next.bot.length)next.result="Rival emptied their hand.";
    else if(next.turns>200)next.result="Draw.";
    setState(next);
  }
  const top=state.pile.at(-1)!;
  return <>
    <div className="uno-card uno-top" data-color={top.color} aria-label={colors[top.color]+" "+top.rank}>{top.rank}</div>
    <p role="status">{state.result||"Match "+colors[top.color]+" or "+top.rank+" · Rival: "+state.bot.length+" cards"}</p>
    <div className="arcade-moves">{state.you.map(card=><button type="button" className="uno-card" data-color={card.color} key={card.id}
      aria-label={colors[card.color]+" "+card.rank} disabled={locked||Boolean(state.result)||!usable(card,top)} onClick={()=>turn(card)}>{card.rank}</button>)}</div>
    <div className="arcade-moves"><button type="button" className="ghost-btn" disabled={locked||Boolean(state.result)} onClick={()=>turn()}>Draw and pass</button></div>
  </>;
}
const boards={chess:["Chess","Classic chess against a computer rival.",ChessBoard],
  "connect-four":["Connect Four","Pick a column and connect four discs first.",ConnectFour],
  uno:["Uno","Number-card rules. Match color or number and empty your hand.",Uno],
  pool:["8-Ball Pool","Solo practice. Clear the rack and pocket the eight ball last.",Pool]} as const;

export function BoardArcade({game}:{game:keyof typeof boards}){
  return game === "pool" || game === "connect-four" || game === "uno" || game === "chess"
    ? <Multiplayer game={game} />
    : <WagerBoard game={game} />;
}

function WagerBoard({game}:{game:"chess"|"uno"}){
  const [name,description,Board]=boards[game];
  const wallet=useWallet();
  const [amount,setAmount]=useState(1);
  const [round,setRound]=useState<{id:number;stake:number;result:BoardOutcome|null}|null>(null);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("Set your stake to play against the computer.");
  // A stake is debited only once; even repeated game-over effects cannot pay twice.
  const activeStake=useRef(0);
  const playing=Boolean(round && !round.result);

  function start(){
    if(activeStake.current||playing)return;
    const stake=betCents(amount,wallet.balance);
    if(stake===null||!wallet.debit(stake)){
      setError("Enter an amount of at least $0.10 within your Play USD balance.");
      return;
    }
    activeStake.current=stake;
    setRound(previous=>({id:(previous?.id??0)+1,stake,result:null}));
    setMessage("Playing for "+formatUSD(stake)+" · win 1.96×, draw refunds the stake.");
    setError("");
  }
  function finish(result:BoardOutcome){
    const stake=activeStake.current;
    if(!stake)return;
    activeStake.current=0;
    const paid=wallet.credit(result==="win"?payout(stake,1.96):result==="draw"?stake:0);
    wallet.record(name,stake,paid);
    setRound(previous=>previous?{...previous,result}:previous);
    setMessage(result==="win"?"You won "+formatUSD(paid)+"!":
      result==="draw"?"Draw · "+formatUSD(paid)+" returned.":"You lost "+formatUSD(stake)+".");
  }
  const cents=Math.round(amount*100);
  return <GameLayout title={name} note="VS Computer · Play USD" panel={
    <BetPanel amount={amount} onAmount={setAmount}
      profitCents={Math.max(0,payout(cents,1.96)-cents)}
      label={round?"Bet again":"Start game"} onAction={start}
      disabled={playing} locked={playing} error={error}
      afterAction={playing?<button type="button" className="ghost-btn" onClick={()=>finish("loss")}>Forfeit · lose stake</button>:null}>
      <p className="hint">{description} Win 1.96× · Draw 1.00× · Loss 0×</p>
    </BetPanel>
  }>
    <div className="arcade-board-stage">
      {round?<><Board key={round.id} onFinish={finish} locked={!playing}/><p role="status" className="arcade-round-status">{message}</p></>:
        <p className="arcade-round-status">Choose a Play USD stake and select Start game.</p>}
    </div>
  </GameLayout>;
}

