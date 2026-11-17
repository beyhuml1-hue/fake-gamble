import { useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents, formatMult, formatUSD, payout } from "../lib/money";
import { randInt } from "../lib/random";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";

const cards = Array.from({length:52}, (_, index)=>({
  value: ["A","2","3","4","5","6","7","8","9","10","J","Q","K"][index%13],
  suit: ["♣","♠","♥","♦"][Math.floor(index/13)],
}));

export function Blitz() {
  const {balance,debit,credit,record} = useWallet();
  const [amount,setAmount] = useState(1);
  const [target,setTarget] = useState(10);
  const [seen,setSeen] = useState<number[]>([]);
  const [repeat,setRepeat] = useState<number|null>(null);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const chance = Array.from({length:target},(_,index)=>(52-index)/52).reduce((total,next)=>total*next,1);
  const multiplier = 0.96 / chance;

  function play(){
    const stake=betCents(amount,balance);
    if(stake===null||!debit(stake)){
      setError("Choose a stake within your Play USD balance.");
      return;
    }
    setError("");
    const drawn=new Set<number>();
    let duplicate:number|null=null;
    while(drawn.size<target){
      const next=luckOn()?drawn.size:randInt(52);
      if(drawn.has(next)){duplicate=next;break;}
      drawn.add(next);
    }
    const paid=duplicate===null?credit(payout(stake,multiplier)):0;
    record("Blitz",stake,paid);
    setSeen([...drawn]);
    setRepeat(duplicate);
    setMessage(duplicate===null ? "All "+target+" cards were unique · "+formatUSD(paid) : "Repeated "+cards[duplicate]!.value+cards[duplicate]!.suit+" · Round lost");
  }

  return <GameLayout title="Blitz" note="One repeat ends the round" panel={
    <BetPanel amount={amount} onAmount={setAmount} profitCents={Math.max(0,payout(amount*100,multiplier)-Math.round(amount*100))}
      label="Draw cards" onAction={play} error={error}>
      <label className="field"><span className="field-label">Unique cards <b>{formatMult(multiplier)}</b></span>
        <div className="game-number-step">
          <input aria-label="Unique cards" type="number" min={2} max={25} value={target}
            onChange={event=>setTarget(Math.max(2,Math.min(25,Number(event.target.value)||2)))}/>
          <button type="button" disabled={target===2} onClick={()=>setTarget(target-1)} aria-label="One less card">−</button>
          <button type="button" disabled={target===25} onClick={()=>setTarget(target+1)} aria-label="One more card">+</button>
        </div>
      </label>
    </BetPanel>
  }>
    <div className="blitz-stage"><div className="blitz-deck" aria-label="Blitz deck">
      {cards.map((card,i)=><div key={i} data-revealed={seen.includes(i)} data-repeat={repeat===i} data-red={i>=26}>
        <b>{card.value}</b><span>{card.suit}</span>
      </div>)}
    </div><p role="status">{message||"Draw without getting the same card twice."}</p></div>
  </GameLayout>;
}

const snakePayouts = [4,2.5,1.4,0.86,0,0,0,0.86,1.4,2.5,4];
const snakeTiles = [null,2,3,4,12,null,null,5,11,null,null,6,10,9,8,7];
const dice = ["⚀","⚁","⚂","⚃","⚄","⚅"];

export function Snakes(){
  const wallet=useWallet();
  const [amount,setAmount]=useState(1);
  const [stake,setStake]=useState(0);
  const [rolled,setRolled]=useState<[number,number]>([1,1]);
  const [last,setLast]=useState<number|null>(null);
  const [count,setCount]=useState(0);
  const [mult,setMult]=useState(1);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  function settle(wager:number,multiplier:number){
    const paid=wallet.credit(payout(wager,multiplier));
    wallet.record("Snakes",wager,paid);
    setStake(0);
    setMessage(paid? "Cashed out · "+formatUSD(paid):"Snake · Round lost");
  }
  function start(){
    if(stake){settle(stake,mult);return;}
    const wager=betCents(amount,wallet.balance);
    if(wager===null||!wallet.debit(wager)){
      setError("Choose a stake within your Play USD balance.");
      return;
    }
    setStake(wager);
    setCount(0);
    setMult(1);
    setLast(null);
    setMessage("");
    setError("");
  }
  function roll(){
    if(!stake)return;
    const pair:[number,number]=luckOn()?[1,1]:[randInt(6)+1,randInt(6)+1];
    const sum=pair[0]+pair[1];
    const next=mult*snakePayouts[sum-2]!;
    setRolled(pair);
    setLast(sum);
    setMult(next);
    setCount(count+1);
    if(!next||count===4)settle(stake,next);
  }

  return <GameLayout title="Snakes" note="Up to five rolls" panel={
    <BetPanel amount={amount} onAmount={setAmount} profitCents={Math.max(0,payout(stake,mult)-stake)}
      label={stake?"Cash out":"Bet"} onAction={start} locked={!!stake} cashout={!!stake} showProfit={false}
      disabled={!!stake&&!count} error={error}
      afterAction={<button className="ghost-btn" type="button" disabled={!stake} onClick={roll}>Roll</button>}/>
  }>
    <div className="snake-stage"><div className="snake-loop" aria-label="Snakes multiplier board">
      {snakeTiles.map((n,i)=>n===null?(i===0?<span key={i} className="snake-pocket">◎</span>:null):
        <span key={i} className="snake-pocket" style={{gridColumn:i%4+1,gridRow:Math.floor(i/4)+1}} data-landed={last===n}>
          {snakePayouts[n-2] ? formatMult(snakePayouts[n-2]!) : "🐍"}
        </span>)}
      <div className="snake-dice"><div>{rolled.map((die,i)=><span key={i} aria-label={"Die "+die}>{dice[die-1]}</span>)}</div>
        <strong>{formatMult(mult)}</strong></div>
    </div><p role="status">{message || (stake ? count+" / 5 rolls" : "Roll the dice and avoid the snakes.")}</p></div>
  </GameLayout>;
}
