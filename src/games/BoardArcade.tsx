import { useEffect, useRef, useState, type ComponentType } from "react";
import { Chess, type Square } from "chess.js";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents, formatCoins, payout } from "../lib/money";
import { randInt, shuffle } from "../lib/random";
import { useWallet } from "../state/wallet";
import { Pool } from "./Pool";

type RoundProps = { onResult?: (outcome: "win" | "loss" | "draw") => void; onAbandon?: () => void };

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
function ConnectFour({ onResult, onAbandon }: RoundProps){
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
  useEffect(() => {
    if (!result) return;
    onResult?.(result.startsWith("You") ? "win" : result.startsWith("Draw") ? "draw" : "loss");
  }, [result, onResult]);
  return <>
    <div className="connect-choices">{Array.from({length:7},(_,i)=><button type="button" className="ghost-btn" key={i} disabled={Boolean(result)||Boolean(board[i])} aria-label={"Drop in column "+(i+1)} onClick={()=>move(i)}>↓</button>)}</div>
    <div className="connect-board" aria-label="Connect Four board">{board.map((disc,i)=><span aria-label={disc===1?"Your disc":disc===2?"Rival disc":"Empty"} data-disc={disc} key={i}/>)}</div>
    <p role="status">{result||"Your turn · gold discs"}</p>
    <button type="button" className="ghost-btn" onClick={()=>{ if (board.some(Boolean) && !result) onAbandon?.(); setBoard(discs); setResult(""); }}>New game</button>
  </>;
}

const glyph:Record<string,string>={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
const value:Record<string,number>={p:1,n:3,b:3,r:5,q:9,k:0};
function ChessBoard({ onResult, onAbandon }: RoundProps){
  const [movesPlayed,setMovesPlayed]=useState<string[]>([]);
  const [from,setFrom]=useState<Square|null>(null);
  const [promotion,setPromotion]=useState<"q"|"r"|"b"|"n">("q");
  const board=new Chess();
  movesPlayed.forEach(move=>board.move(move));
  const possible=from?board.moves({square:from,verbose:true}):[];
  const ended=board.isGameOver();
  useEffect(()=>{
    const current=new Chess();
    movesPlayed.forEach(move=>current.move(move));
    if(current.turn()!=="b"||current.isGameOver())return;
    const timer=window.setTimeout(()=>{
      const moves=shuffle(current.moves({verbose:true}));
      moves.sort((a,b)=>(value[b.captured??""]??0)-(value[a.captured??""]??0));
      setMovesPlayed([...movesPlayed,moves[0]!.san]);
    },400);
    return ()=>window.clearTimeout(timer);
  },[movesPlayed]);
  useEffect(() => {
    const current = new Chess();
    movesPlayed.forEach(move => current.move(move));
    if (!current.isGameOver()) return;
    onResult?.(current.isCheckmate() ? (current.turn() === "w" ? "loss" : "win") : "draw");
  }, [movesPlayed, onResult]);
  function move(square:Square){
    if(ended||board.turn()!=="w")return;
    const legal=possible.find(option=>option.to===square && (!option.promotion||option.promotion===promotion));
    if(legal){setMovesPlayed([...movesPlayed,legal.san]);setFrom(null);return;}
    setFrom(board.get(square)?.color==="w"?square:null);
  }
  return <>
    <div className="arcade-chess">{board.board().flatMap((row,r)=>row.map((piece,c)=>{
      const square=("abcdefgh"[c]+String(8-r)) as Square;
      return <button type="button" key={square} aria-label={square+(piece?" "+piece.color+piece.type:"")} aria-pressed={from===square}
        data-dark={(r+c)%2===1} data-legal={possible.some(option=>option.to===square)} onClick={()=>move(square)}>
        {piece ? glyph[piece.color+piece.type] : ""}
      </button>;
    }))}</div>
    <p role="status">{board.isCheckmate()?(board.turn()==="w"?"Checkmate · rival wins":"Checkmate · you win"):ended?"Draw":board.turn()==="w"?board.inCheck()?"White to move · check":"White to move":"Rival thinking…"}</p>
    <label>Promote to <select value={promotion} onChange={event=>setPromotion(event.target.value as typeof promotion)}>
      <option value="q">Queen</option><option value="r">Rook</option><option value="b">Bishop</option><option value="n">Knight</option>
    </select></label>
    <button type="button" className="ghost-btn" onClick={()=>{ if (movesPlayed.length && !ended) onAbandon?.(); setMovesPlayed([]); setFrom(null); }}>New game</button>
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
function Uno({ onResult, onAbandon }: RoundProps){
  const [state,setState]=useState(unoStart);
  function turn(card?:Card){
    if(state.result)return;
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
  useEffect(() => {
    if (!state.result) return;
    onResult?.(state.result.startsWith("You") ? "win" : state.result.startsWith("Draw") ? "draw" : "loss");
  }, [state.result, onResult]);
  const top=state.pile.at(-1)!;
  return <>
    <div className="uno-card uno-top" data-color={top.color} aria-label={colors[top.color]+" "+top.rank}>{top.rank}</div>
    <p role="status">{state.result||"Match "+colors[top.color]+" or "+top.rank+" · Rival: "+state.bot.length+" cards"}</p>
    <div className="arcade-moves">{state.you.map(card=><button type="button" className="uno-card" data-color={card.color} key={card.id}
      aria-label={colors[card.color]+" "+card.rank} disabled={Boolean(state.result)||!usable(card,top)} onClick={()=>turn(card)}>{card.rank}</button>)}</div>
    <div className="arcade-moves"><button type="button" className="ghost-btn" disabled={Boolean(state.result)} onClick={()=>turn()}>Draw and pass</button>
      <button type="button" className="ghost-btn" onClick={()=>{ if (state.turns && !state.result) onAbandon?.(); setState(unoStart()); }}>New game</button></div>
  </>;
}
const boards: Record<"chess" | "connect-four" | "uno" | "pool", [string, string, ComponentType<RoundProps>]> = {
  chess: ["Chess", "Classic chess against a computer rival.", ChessBoard],
  "connect-four": ["Connect Four", "Pick a column and connect four discs first.", ConnectFour],
  uno: ["Uno", "Number-card rules. Match color or number and empty your hand.", Uno],
  pool: ["8-Ball Pool", "Clear the rack and pocket the eight ball last.", Pool],
};

export function BoardArcade({ game }: { game: keyof typeof boards }) {
  const { balance, debit, credit, record } = useWallet();
  const [name, description, Board] = boards[game];
  const [amount, setAmount] = useState(1);
  const [phase, setPhase] = useState<"idle" | "live" | "done">("idle");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [round, setRound] = useState(0);
  const stakeRef = useRef(0);
  const settled = useRef(true);
  const recordRef = useRef(record);
  const creditRef = useRef(credit);
  recordRef.current = record;
  creditRef.current = credit;

  useEffect(() => () => {
    if (!settled.current) {
      settled.current = true;
      recordRef.current(name, stakeRef.current, 0);
    }
  }, [name]);

  function finish(outcome: "win" | "loss" | "draw") {
    if (settled.current) return;
    settled.current = true;
    const wager = stakeRef.current;
    const mult = outcome === "win" ? 1.96 : outcome === "draw" ? 1 : 0;
    const pay = mult ? creditRef.current(payout(wager, mult)) : 0;
    recordRef.current(name, wager, pay);
    setPhase("done");
    setNote(outcome === "win" ? "Won " + formatCoins(pay) + " coins." : outcome === "draw" ? "Stake returned." : "Round lost.");
  }

  function begin() {
    if (phase === "live") return;
    const wager = betCents(amount, balance);
    if (wager == null || !debit(wager)) {
      setError("Minimum bet is 0.10 coins, and it can't be more than your balance.");
      return;
    }
    stakeRef.current = wager;
    settled.current = false;
    setError("");
    setNote("");
    setPhase("live");
    setRound((value) => value + 1);
  }

  return <GameLayout title={name} note="Play coins · 1.96× on a win" panel={
    <BetPanel amount={amount} onAmount={setAmount} locked={phase === "live"} profitCents={Math.round(amount * 96)}
      label={phase === "live" ? "In round" : "Play"} onAction={begin} disabled={phase === "live"} error={error} />
  }>
    {phase === "live" ? <div className="arcade-board-stage"><Board key={round} onResult={finish} onAbandon={() => finish("loss")} /></div> :
      <div className="room-empty"><h2>{note || "Place a bet"}</h2><p>{description} A win pays 1.96×. A draw returns the stake. Coins have no cash value.</p></div>}
  </GameLayout>;
}
