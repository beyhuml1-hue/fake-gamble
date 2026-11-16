import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { CASES, caseImage } from "../data/cases";
import { betCents, formatUSD, payout } from "../lib/money";
import { randInt, random, shuffle } from "../lib/random";
import { useWallet } from "../state/wallet";

const directions = ["Up", "Down"];
const choices: Record<string, string[]> = {
  rps: ["Rock", "Paper", "Scissors"],
  double: ["Red", "Green", "Black", "Bait"],
  "pig-race": ["Jade", "Ruby", "Gold", "Slate", "Violet", "Azure"],
  stocks: directions,

};
const derbyWeights = [28,22,18,14,11,7];
const derbyPayouts = [3.25,4.13,5.05,6.50,8.27,13];
const lavaTiles = Array.from({length:49}, (_, i) => i);
const lavaOdds = [36,31,26,36,31,26,36,31,26].map(count=>count/49);
const doublePayouts = [2,14,2,7];
const doubleReel = [0,2,0,3,2,0,2,0,2,1,0,2,0,2,3,0,2,0,2,0,2,0,2,0,2,0,2,0,2,0];
const rpsPayout = (wins:number) => wins > 0 ? 1.85*2**(wins-1) : 1;
const suits = ["♣", "♦", "♥", "♠"];
function cardLabel(value: number) {
  return ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"][value % 13] + suits[Math.floor(value / 13)]!;
}
function handScore(hand: number[]) {
  const ranks = hand.map(card => card % 13 + 2).sort((a,b) => b-a);
  const groups = [...new Set(ranks)].map(rank => [ranks.filter(value => value === rank).length, rank])
    .sort(([an,ar],[bn,br]) => bn! - an! || br! - ar!);
  const flush = hand.every(card => Math.floor(card / 13) === Math.floor(hand[0]! / 13));
  const straight = groups.length === 5 && (ranks[0]! - ranks[4]! === 4 ? ranks[0]! : String(ranks) === "14,5,4,3,2" ? 5 : 0);
  const pairs = groups.filter(([count]) => count === 2).length;
  const high = groups[0]![0];
  const category = flush && straight ? 8 : high === 4 ? 7 : high === 3 && pairs ? 6 : flush ? 5 : straight ? 4 : high === 3 ? 3 : pairs;
  return [category, ...(straight ? [straight] : groups.map(([,rank]) => rank!))].concat([0,0,0,0,0]).slice(0,6)
    .reduce((score,value) => score * 15 + value, 0);
}
function openCase(index: number) {
  const drops = CASES[index]!.drops;
  let roll = random() * drops.reduce((total, drop) => total + drop.weight, 0);
  return (drops.find(drop => (roll -= drop.weight) <= 0) ?? drops[drops.length - 1]!).item;
}

export function ArcadeRound({game}: {game: {id: string; name: string; blurb: string}}) {
  const wallet = useWallet();
  const currentWallet = useRef(wallet);
  currentWallet.current = wallet;
  const pending = useRef<{stake:number;claimed:number}|null>(null);
  useEffect(() => () => {
    const round = pending.current;
    if (!round) return;
    pending.current = null;
    const {credit,record} = currentWallet.current;
    record(game.name,round.stake,credit(payout(round.stake,round.claimed)));
  },[game.name]);
  const [amount,setAmount] = useState(1);
  const [choice,setChoice] = useState(0);
  const [stake,setStake] = useState(0);
  const [turn,setTurn] = useState(0);
  const [message,setMessage] = useState(game.blurb);
  const [error,setError] = useState("");
  const [cards,setCards] = useState<number[]>([]);
  const [deck,setDeck] = useState<number[]>([]);
  const [held,setHeld] = useState<number[]>([]);
  const [draw,setDraw] = useState<number[]>([]);
  const [claimed,setClaimed] = useState(0);
  const [race,setRace] = useState<number[]>([]);
  const [stone,setStone] = useState<number|null>(null);
  const [sunken,setSunken] = useState<number[]>([]);
  const [difficulty,setDifficulty] = useState(1);
  const [target,setTarget] = useState(2);
  const [result,setResult] = useState<number|null>(null);
  const [opening,setOpening] = useState<{you:string;rival:string}|null>(null);
  const isDraw = game.id === "draw";
  const isPoker = game.id === "poker";
  const isRps = game.id === "rps";
  const isLava = game.id === "floor-is-lava";
  const isCase = game.id === "case-battles";
  const isDouble = game.id === "double";
  const isSlide = game.id === "slide";
  const isDerby = game.id === "pig-race";
  const isStocks = game.id === "stocks";
  const board = isLava ? lavaOdds.map(odds=>Math.round(odds*49+(1-difficulty)*5)/49) : undefined;
  const options = isCase ? CASES.map(box => box.name) : choices[game.id] ?? [];
  const total = isRps ? rpsPayout(turn) : board?.slice(0,turn).reduce((value, chance) => value / chance, 0.97) ?? 0;

  function finish(wager: number, multiplier: number, result: string) {
    pending.current = null;
    const paid = wallet.credit(payout(wager,multiplier));
    wallet.record(game.name,wager,paid);
    setMessage(result + (paid ? " · " + formatUSD(paid) + " Play USD returned" : " · Round lost"));
    setStake(0);
  }

  function play(selected = choice) {
    if (stake) {
      if (isDraw) {
        if (turn >= 5) return;
        setTurn(turn+1);
        const next = draw.map(value => value > 0 && random() < [0.72,0.63,0.52][difficulty]! ? value * [1.3,1.45,1.75][difficulty]! : 0);
        setDraw(next);
        if (next.every(value=>value===0)) finish(stake,claimed,"Draw complete");
        return;
      }
      if (isPoker) {
        let index = 0;
        const final = cards.map((card, slot) => held.includes(slot) ? card : deck[index++]!);
        const rival = deck.slice(5,10);
        const score = Math.sign(handScore(final) - handScore(rival));
        setCards(final);
        finish(stake, score === 1 ? 1.96 : score === 0 ? 1 : 0, "Rival: " + rival.map(cardLabel).join(" ") + (score === 1 ? " · You won" : score === 0 ? " · Tie" : ""));
        return;
      }
      finish(stake,total,"Cashed out after " + turn + " safe moves");
      return;
    }
    const wager = betCents(isCase ? CASES[selected]!.price : amount,wallet.balance);
    if (wager == null || !wallet.debit(wager)) {
      setError("Enter a stake of at least $0.10 within your Play USD balance.");
      return;
    }
    setError("");
    setTurn(0);
    if (board || isPoker || isDraw || isRps) {
      setStone(null);
      setSunken([]);
      pending.current = {stake:wager,claimed:0};
      setStake(wager);
      setClaimed(0);
      if (isPoker) {
        const pack = shuffle(Array.from({length:52},(_,i)=>i));
        setCards(pack.slice(0,5));
        setDeck(pack.slice(5));
        setHeld([]);
      }
      if (isDraw) setDraw(Array<number>(9).fill(1));
      setMessage(isPoker ? "Select the cards to keep, then draw." : isDraw ? "Claim a card or draw to raise its value." : isRps ? "Pick your throw." : "Choose your next move.");
      return;
    }
    if (isCase) {
      const me = openCase(selected), rival = openCase(selected);
      setOpening({you:me.id,rival:rival.id});
      finish(wager,me.worth === rival.worth ? 1 : me.worth > rival.worth ? 1.96 : 0,"You opened " + me.name + " · Rival opened " + rival.name);
      return;
    }
    if (game.id === "stocks") {
      const candles = Array.from({length:12},()=> (random() - 0.5) * 2);
      const change = candles.reduce((sum,value)=>sum+value,0);
      setRace(candles.map((_,i)=>50+candles.slice(0,i+1).reduce((sum,value)=>sum+value,0)*7));
      finish(wager,(change >= 0 ? 0 : 1) === selected ? 1.96 : 0,"Market closed " + (change > 0 ? "+" : "") + change.toFixed(2) + "%");
      return;
    }
    if (game.id === "slide") {
      const threshold = Math.min(1000,Math.max(1.01,target));
      const result = Math.max(1, Math.floor(98 / random()) / 100);
      setResult(result);
      finish(wager,result >= threshold ? threshold : 0,"Slider stopped at " + result.toFixed(2) + "×");
      return;
    }
    let raceRoll = randInt(100);
    const outcome = game.id === "pig-race" ? derbyWeights.findIndex(weight=>(raceRoll-=weight)<0) :
      isDouble ? doubleReel[randInt(doubleReel.length)]! : randInt(options.length);
    if (game.id === "pig-race") setRace(options.map((_,lane)=> lane === outcome ? 100 : 66 + randInt(29)));
    setResult(outcome);
    const multiplier = selected !== outcome ? 0 : isDerby ? derbyPayouts[selected]! : doublePayouts[selected]!;
    finish(wager,multiplier,"Result: " + options[outcome]);
  }

  function move(tile: number) {
    if (!stake || !board) return;
    const chance = board[turn]!;
    const sink = isLava ? shuffle(lavaTiles).slice(0,49-Math.round(49*chance)) : [];
    if (isLava) {
      setStone(tile);
      setSunken(sink);
    }
    if (sink.includes(tile)) {
      finish(stake,0,"That stone sank");
      return;
    }
    const next = turn + 1;
    setTurn(next);
    const mult = total / chance;
    if (next === board.length) finish(stake,mult,"Course cleared");
    else setMessage(next + " safe moves · " + mult.toFixed(2) + "×");
  }

  function claim(index: number) {
    if (!stake || !draw[index]) return;
    const next = draw.map((value,i)=>i===index ? 0 : value);
    const sum = claimed + draw[index]! / 9;
    setDraw(next);
    setClaimed(sum);
    if (pending.current) pending.current.claimed = sum;
    if (next.every(value=>value===0)) finish(stake,sum,"Cards claimed");
    else setMessage("Claimed " + sum.toFixed(2) + "× so far");
  }
  function throwHand(hand: number) {
    if (!stake) return;
    const rival = randInt(3);
    const result = "Rival threw " + options[rival];
    if (rival === hand) { setMessage(result + " · Tie. Throw again."); return; }
    if ((hand+2)%3 !== rival) { finish(stake,0,result); return; }
    const won = turn+1;
    if (won === 12) { finish(stake,rpsPayout(won),result+" · Streak cleared"); return; }
    setTurn(won);
    setMessage(result + " · " + rpsPayout(won).toFixed(2) + "×. Cash out or throw again.");
  }

  const label = stake ? isPoker ? "Draw cards" : isDraw ? "Draw again" : "Cash out" :
    isPoker ? "Deal" : isCase ? "Create battle" : isDerby ? "Race" : isStocks ? "Place order" : "Play";
  const quote = isSlide ? Math.max(0,target-1) : isDouble ? doublePayouts[choice]!-1 : 0;
  const profit = stake && (board || isRps) ? Math.max(0,payout(stake,total)-stake) : payout(Math.round(amount*100),quote);
  return <GameLayout title={game.name} note={isCase ? "VS Computer" : "Play USD"} panel={
    <BetPanel amount={isCase?CASES[choice]!.price:amount} onAmount={setAmount} locked={Boolean(stake)||isCase}
      profitCents={profit} error={error} showProfit={!isCase&&!isPoker&&!isDouble&&!isStocks&&!isDerby}
      label={label} onAction={()=>play()} cashout={Boolean(stake)}
      disabled={Boolean(stake && ((board || isRps) && !turn || isDraw && turn>=5))}>
      {isCase && <label className="field"><span className="field-label">Case</span>
        <select value={choice} onChange={event=>setChoice(Number(event.target.value))}>
          {options.map((option,i)=><option key={option} value={i}>{option}</option>)}
        </select>
      </label>}
      {(isLava||isDraw) && <div className="field"><span className="field-label">Difficulty</span>
        <div className="select">{["Easy","Medium","Hard"].map((option,i)=>
          <button key={option} type="button" disabled={!!stake} className={difficulty===i?"on":""} onClick={()=>setDifficulty(i)}>{option}</button>)}</div>
      </div>}
      {isDerby && <div className="derby-pick" aria-label="Choose a driver">
        <div><span>Driver</span><span>Chance</span><span>Payout</span></div>
        {options.map((option,i)=><button key={option} type="button" aria-pressed={i===choice} onClick={()=>setChoice(i)}>
          <span>{i+1} · {option}</span><span>{derbyWeights[i]}%</span><b>{derbyPayouts[i]}×</b></button>)}
      </div>}
      {(isDouble||isStocks) && <div className="field"><span className="field-label">{isStocks?"Direction":"Color"}</span>
        <div className="select">{options.map((option,i)=><button key={option} type="button" className={choice===i?"on":""}
          onClick={()=>setChoice(i)}>{option}</button>)}</div>
      </div>}
      {isSlide && <label className="field"><span className="field-label">Target multiplier</span>
        <div className="game-number-step"><input type="number" min={1.01} max={1000} step={0.1} value={target}
          onChange={event=>setTarget(event.target.valueAsNumber||1.01)}/></div>
      </label>}
      {isRps && <div className="field"><span className="field-label">Throw</span>
        <div className="select">{options.map((option,i)=><button key={option} type="button" disabled={!stake} onClick={()=>throwHand(i)}>{option}</button>)}</div>
      </div>}
    </BetPanel>
  }>
    <div className="arcade-round">
      {isLava && <>
        <small>Level {Math.min(3,Math.floor(turn/3)+1)} of 3</small>
        <div className="lava-board" aria-label="Lava stepping stones">{lavaTiles.map(index=>
          <button key={index} type="button" disabled={!stake} data-sunk={sunken.includes(index)} data-chosen={stone===index}
            aria-label={"Stone "+(index+1)} onClick={()=>move(index)} />)}</div>
      </>}
      {isRps && <div className="rps-stage"><div className="rps-figures" aria-hidden="true"><span>✊</span><span>✋</span><span>✌️</span></div>
        <div className="play-stats-pair"><span>Win streak <b>{turn}</b></span><span>Next win <b>{rpsPayout(turn+1).toFixed(2)}×</b></span></div>
        <div className="rps-multipliers">{Array.from({length:6},(_,i)=><span key={i} data-current={i===turn}>{rpsPayout(i+1).toFixed(2)}×</span>)}</div>
      </div>}
      {isPoker && <div className="draw-poker-table"><div className="poker-seat">Computer <span>◆ ◆ ◆ ◆ ◆</span></div>
        <div className="arcade-moves">{(cards.length?cards:Array.from({length:5},(_,i)=>i)).map((card,i)=><button
          className={"arcade-playing-card"+(cards.length?"":" poker-back")} key={card} disabled={!stake} type="button"
          aria-pressed={held.includes(i)} onClick={()=>setHeld(held.includes(i)?held.filter(j=>j!==i):[...held,i])}>{cards.length?cardLabel(card):"◆"}</button>)}</div>
        <div className="poker-seat">You</div>
      </div>}
      {isDraw && <div className="draw-stage">
        <div className="rps-multipliers">{[1,1.3,1.7,2.5,4,6.5,10,20,50,150].map(value=><span key={value}>{value}×</span>)}</div>
        <div className="draw-cards">{(draw.length?draw:Array<number>(9).fill(0)).map((value,i)=><button key={i}
          type="button" disabled={!stake||!value} onClick={()=>claim(i)} data-live={!!value}>
          <b>{value?"◆":"♧"}</b><span>{value ? (value/9).toFixed(2) + "×" : "BlockBet"}</span>
        </button>)}</div>
      </div>}
      {isCase && <div className="battle-openings">
        <figure><figcaption>You</figcaption><img src={caseImage(opening?.you??CASES[choice]!.id)} alt="Your side"/></figure>
        <b>VS</b>
        <figure><figcaption>Computer</figcaption><img src={caseImage(opening?.rival??CASES[choice]!.id)} alt="Computer's side"/></figure>
      </div>}
      {isDouble && <div className="double-stage">
        <div className="double-reel" aria-label="Color reel">
          {Array.from({length:15},(_,i)=>{
            const index = result===null ? i : i===7 ? result : doubleReel[(i+result)%doubleReel.length]!;
            return <span key={i} data-color={index} data-center={i===7}>{["◆","●","◆","✦"][index]}</span>;
          })}
        </div>
        <div className="double-picks">{options.map((option,i)=><button key={option} type="button" data-color={i}
          onClick={()=>{setChoice(i);play(i);}}>{option} <b>{doublePayouts[i]}×</b></button>)}</div>
      </div>}
      {isDerby && <div className="derby-stage" aria-label="Derby lanes">
        {options.map((option,i)=><div key={option} className="derby-lane" data-finish={race[i]===100}>
          <small>{option}</small><span style={{"--lane-position":(race[i]??0)+"%"} as React.CSSProperties}>🏎</span>
        </div>)}
      </div>}
      {isStocks && <div className="market-stage">
        <div className="market-header"><b>BlockBet Index</b><span>{race.length?"Round closed":"Awaiting order"}</span></div>
        <svg viewBox="0 0 600 250" role="img" aria-label="Price movement">
          {[25,75,125,175,225].map(y=><line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#3b454b" strokeWidth="1"/>)}
          <polyline points={[50,...(race.length?race:Array<number>(12).fill(50))].map((value,i)=>i*50+","+(250-Math.min(97,Math.max(3,value))*2.5)).join(" ")}
            fill="none" stroke={race.at(-1)!<50?"#ee6977":"#56d799"} strokeWidth="3" />
        </svg>
      </div>}
      {isSlide && <div className="slide-stage"><span className="slide-indicator" aria-hidden="true"/><strong>{result===null?"—":result.toFixed(2)+"×"}</strong>
        <div className="slide-strip" aria-label="Multiplier scale">{[1,1.25,1.5,1.75,2,2.5,3,4,5,7.5,10].map(value=>
          <span key={value} data-hit={result!==null&&result>=value}>{value}×</span>)}</div>
      </div>}
      <p role="status" className="arcade-round-status">{message}</p>
    </div>
  </GameLayout>;
}
