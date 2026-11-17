import { useEffect, useMemo, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { EDGE } from "../lib/math";
import { betCents, formatMult, formatUSD, payout } from "../lib/money";
import { shuffle } from "../lib/random";
import { useWallet } from "../state/wallet";
import "./motion-upgrades.css";

type Card = { rank: string; suit: string; id: number };
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

function freshShoe(): Card[] {
  return shuffle(Array.from({length:52},(_,id)=>({rank:RANKS[id%13]!,suit:SUITS[Math.floor(id/13)]!,id})));
}
function rankOf(card: Card) { return RANKS.indexOf(card.rank); }
type Guess = "higher" | "lower" | "same";

export function Hilo() {
  const wallet = useWallet();
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const [amount,setAmount] = useState(1);
  const [shoe,setShoe] = useState<Card[]>(freshShoe);
  const [card,setCard] = useState<Card|null>(null);
  const [trail,setTrail] = useState<Card[]>([]);
  const [mult,setMult] = useState(1);
  const [active,setActive] = useState(false);
  const [note,setNote] = useState("Draw your first card.");
  const [win,setWin] = useState<boolean|null>(null);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [turn,setTurn] = useState(0);
  const actionLocked = useRef(false);
  const timer = useRef(0);
  const round = useRef<{stake:number;mult:number;wins:number}|null>(null);

  useEffect(()=>()=> {
    window.clearTimeout(timer.current);
    const saved = round.current;
    round.current = null;
    if (saved) {
      const paid=walletRef.current.credit(payout(saved.stake,saved.mult));
      walletRef.current.record("Hi-Lo",saved.stake,paid);
    }
  },[]);

  const odds = useMemo(()=>{
    if (!card) return {higher:0,lower:0,same:0};
    const total=shoe.length;
    const price=(count:number)=>count?((1-EDGE)*total)/count:0;
    return {
      higher:price(shoe.filter(item=>rankOf(item)>rankOf(card)).length),
      lower:price(shoe.filter(item=>rankOf(item)<rankOf(card)).length),
      same:price(shoe.filter(item=>rankOf(item)===rankOf(card)).length),
    };
  },[shoe,card]);

  function animate(){
    actionLocked.current=true;
    setBusy(true);
    setTurn(previous=>previous+1);
    window.clearTimeout(timer.current);
    timer.current=window.setTimeout(()=>{
      actionLocked.current=false;
      setBusy(false);
    },450);
  }

  function show(next:Card[],drawn:Card) {
    // Refill before calculating the NEXT action's odds. Never replace the
    // advertised draw population between a quote and the corresponding draw.
    setShoe(next.length?next:freshShoe());
    setCard(drawn);
    setTrail(previous=>[...previous,drawn].slice(-9));
    animate();
  }

  function start(){
    if(actionLocked.current||round.current)return;
    const stake=betCents(amount,wallet.balance);
    if(stake===null||!wallet.debit(stake)){
      setError("Choose a bet from $0.10 within your balance.");
      return;
    }
    const next=freshShoe();
    const first=next.pop()!;
    round.current={stake,mult:1,wins:0};
    setActive(true);
    setMult(1);
    setTrail([]);
    setError("");
    setNote("Ace is low. Choose higher, lower, same, or skip.");
    setWin(null);
    show(next,first);
  }

  function guess(direction:Guess){
    const saved=round.current;
    if(actionLocked.current||!saved||!card||!odds[direction])return;
    const next=[...shoe];
    const drawn=next.pop()!;
    const difference=rankOf(drawn)-rankOf(card);
    const correct=direction==="higher"?difference>0:direction==="lower"?difference<0:difference===0;
    show(next,drawn);
    setWin(correct);
    if(!correct){
      round.current=null;
      setActive(false);
      wallet.record("Hi-Lo",saved.stake,0);
      setNote("Wrong card. Start a new round.");
      return;
    }
    saved.mult*=odds[direction];
    saved.wins++;
    setMult(saved.mult);
    setNote("Correct. Cash out or keep going.");
  }

  function cashout(){
    const saved=round.current;
    if(actionLocked.current||!saved||!saved.wins)return;
    round.current=null;
    const paid=wallet.credit(payout(saved.stake,saved.mult));
    wallet.record("Hi-Lo",saved.stake,paid);
    setActive(false);
    setNote("Cashed out "+formatUSD(paid));
  }
  function skip(){
    if(actionLocked.current||!round.current)return;
    const next=[...shoe];
    show(next,next.pop()!);
    setNote("Card skipped. Your multiplier stays the same.");
    setWin(null);
  }

  const stake=round.current?.stake??Math.round(amount*100);
  const profit=active?Math.max(0,payout(stake,mult)-stake):0;
  return <GameLayout title="Hi-Lo" note="Ace low · strict higher/lower" panel={
    <BetPanel amount={amount} onAmount={setAmount} profitCents={profit}
      label={busy?"Dealing…":active?"Cash out "+formatUSD(payout(stake,mult)):"Deal first card"}
      onAction={active?cashout:start} disabled={busy||(active&&!round.current?.wins)}
      cashout={active} locked={active||busy} error={error}>
      <div className="hilo-panel-choices">
        {(["higher","lower","same"] as Guess[]).map(direction=><button key={direction} type="button"
          disabled={!active||busy||!odds[direction]} onClick={()=>guess(direction)}>
          <span>{direction==="higher"?"↑":direction==="lower"?"↓":"="} {direction}</span>
          <strong>{odds[direction]?formatMult(odds[direction]):"—"}</strong>
        </button>)}
      </div>
    </BetPanel>
  }>
    <div className={"hilo hilo-enhanced"+(busy?" is-dealing":"")}>
      <div className="hilo-table-label">Next card</div>
      {card?<div key={turn} className={"hilo-card "+(["♥","♦"].includes(card.suit)?"red":"")} aria-label={card.rank+card.suit}>
        <span>{card.rank}<small>{card.suit}</small></span><strong>{card.suit}</strong><span className="hilo-card-bottom">{card.rank}</span>
      </div>:<div className="hilo-card back"><b>?</b></div>}
      <div className="hilo-multiplier">{formatMult(mult)}</div>
      <p role="status" className={"result-line"+(win===true?" win":win===false?" lose":"")}>{note}</p>
      <button className="ghost-btn" type="button" disabled={!active||busy} onClick={skip}>Skip card</button>
      <div className="hilo-history" aria-label="Card history">{trail.map((item,i)=><span key={turn+"-"+i} data-red={["♥","♦"].includes(item.suit)}>{item.rank}{item.suit}</span>)}</div>
    </div>
  </GameLayout>;
}

