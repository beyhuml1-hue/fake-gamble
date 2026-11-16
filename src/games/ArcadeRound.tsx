import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { CASES } from "../data/cases";
import { betCents, formatUSD, payout } from "../lib/money";
import { randInt, random, shuffle } from "../lib/random";
import { useWallet } from "../state/wallet";

const directions = ["Up", "Down"];
const choices: Record<string, string[]> = {
  rps: ["Rock", "Paper", "Scissors"],
  double: ["Red", "Black", "Gold"],
  "pig-race": ["Jade", "Ruby", "Gold", "Slate", "Violet", "Azure"],
  stocks: directions,
  slide: ["2×", "3×", "5×", "10×"],
  blitz: ["1", "2", "3", "4", "5", "6"],
};
const derbyWeights = [28,22,18,14,11,7];
const derbyPayouts = [3.25,4.13,5.05,6.50,8.27,13];
const lavaTiles = Array.from({length:49}, (_, i) => i);
const lavaOdds = [36,31,26,36,31,26,36,31,26].map(count=>count/49);
const paths: Record<string, number[]> = {
  "floor-is-lava": lavaOdds,
  snakes: [0.9, 0.8, 0.8, 0.7, 0.7, 0.6, 0.6, 0.5],
};
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
  const board = paths[game.id];
  const isDraw = game.id === "draw";
  const isPoker = game.id === "poker";
  const isRps = game.id === "rps";
  const isLava = game.id === "floor-is-lava";
  const isCase = game.id === "case-battles";
  const options = isCase ? CASES.map(box => box.name) : choices[game.id] ?? [];
  const total = isRps ? 2**turn : board?.slice(0,turn).reduce((value, chance) => value / chance, 0.97) ?? 0;

  function finish(wager: number, multiplier: number, result: string) {
    pending.current = null;
    const paid = wallet.credit(payout(wager,multiplier));
    wallet.record(game.name,wager,paid);
    setMessage(result + (paid ? " · " + formatUSD(paid) + " Play USD returned" : " · Round lost"));
    setStake(0);
  }

  function play() {
    if (stake) {
      if (isDraw) {
        if (turn >= 5) return;
        setTurn(turn+1);
        const next = draw.map(value => value > 0 && random() < 0.63 ? value * 1.45 : 0);
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
    const wager = betCents(isCase ? CASES[choice]!.price : amount,wallet.balance);
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
      const me = openCase(choice), rival = openCase(choice);
      finish(wager,me.worth === rival.worth ? 1 : me.worth > rival.worth ? 1.96 : 0,"You opened " + me.name + " · Rival opened " + rival.name);
      return;
    }
    if (game.id === "stocks") {
      const candles = Array.from({length:12},()=> (random() - 0.5) * 2);
      const change = candles.reduce((sum,value)=>sum+value,0);
      setRace(candles.map((_,i)=>50+candles.slice(0,i+1).reduce((sum,value)=>sum+value,0)*7));
      finish(wager,(change >= 0 ? 0 : 1) === choice ? 1.96 : 0,"Market closed " + (change > 0 ? "+" : "") + change.toFixed(2) + "%");
      return;
    }
    if (game.id === "slide") {
      const target = [2,3,5,10][choice]!;
      const result = Math.max(1, Math.floor(98 / random()) / 100);
      setRace([Math.min(100,result / 10 * 100)]);
      finish(wager,result >= target ? target : 0,"Slider stopped at " + result.toFixed(2) + "×");
      return;
    }
    let raceRoll = randInt(100);
    const outcome = game.id === "pig-race" ? derbyWeights.findIndex(weight=>(raceRoll-=weight)<0) :
      game.id === "double" ? [0,0,0,0,0,0,0,1,1,1,1,1,1,1,2][randInt(15)]! : randInt(options.length);
    if (game.id === "pig-race") setRace(options.map((_,lane)=> lane === outcome ? 100 : 66 + randInt(29)));
    const multiplier = choice !== outcome ? 0 : game.id === "pig-race" ? derbyPayouts[choice]! :
      game.id === "double" ? (choice === 2 ? 14 : 2) : options.length * 0.98;
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
    if (isLava ? sink.includes(tile) : random()>=chance) {
      finish(stake,0,game.id === "snakes" ? "You landed on a snake" : "That stone sank");
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
    if (won === 12) { finish(stake,2**won,result+" · Streak cleared"); return; }
    setTurn(won);
    setMessage(result + " · " + 2**won + "×. Cash out or throw again.");
  }

  return <GameLayout title={game.name} note="Play USD" panel={
    <BetPanel amount={isCase?CASES[choice]!.price:amount} onAmount={setAmount} locked={Boolean(stake)||isCase}
      profitCents={stake && (board || isRps) ? Math.max(0,payout(stake,total)-stake) : 0} error={error}
      label={stake ? isPoker ? "Draw cards" : isDraw ? "Draw again" : "Cash out" : isPoker ? "Deal" : "Play"}
      onAction={play} cashout={Boolean(stake)} disabled={Boolean(stake && ((board || isRps) && !turn || isDraw && turn>=5))}>
      {options.length>0 && !isRps && <label className="field"><span className="field-label">{isCase?"Case":"Pick"}</span>
        <select value={choice} onChange={event=>setChoice(Number(event.target.value))}>
          {options.map((option,i)=><option key={option} value={i}>{option}{game.id==="pig-race"? " · "+derbyWeights[i]+"% · "+derbyPayouts[i]+"×":""}</option>)}
        </select>
      </label>}
    </BetPanel>
  }>
    <div className="arcade-round">
      <div className="arcade-game-art" data-game={game.id} aria-hidden="true" />
      {isLava && <>
        <small>Level {Math.min(3,Math.floor(turn/3)+1)} of 3</small>
        <div className="lava-board" aria-label="Lava stepping stones">{lavaTiles.map(index=>
          <button key={index} type="button" disabled={!stake} data-sunk={sunken.includes(index)} data-chosen={stone===index}
            aria-label={"Stone "+(index+1)} onClick={()=>move(index)} />)}</div>
      </>}
      {game.id==="snakes" && <button type="button" className="ghost-btn" disabled={!stake} onClick={()=>move(0)}>Roll dice</button>}
      {isRps && <div className="arcade-moves">{options.map((option,i)=>
        <button type="button" key={option} className="ghost-btn" disabled={!stake} onClick={()=>throwHand(i)}>{option}</button>)}</div>}
      {isPoker && <div className="arcade-moves">{cards.map((card,i)=><button className="arcade-playing-card" key={card} disabled={!stake} type="button"
        aria-pressed={held.includes(i)} onClick={()=>setHeld(held.includes(i)?held.filter(j=>j!==i):[...held,i])}>{cardLabel(card)}</button>)}</div>}
      {isDraw && <div className="arcade-moves">{draw.map((value,i)=><button className="ghost-btn" key={i} disabled={!stake||!value}
        type="button" onClick={()=>claim(i)}>{value ? "Claim " + (value/9).toFixed(2) + "×" : "—"}</button>)}</div>}
      {race.length>0 && <div className="arcade-track" aria-hidden="true">
        {race.map((value,i)=><span key={i} style={{"--progress":Math.max(0,Math.min(100,value)) + "%"} as React.CSSProperties} />)}
      </div>}
      <p role="status">{message}</p>
    </div>
  </GameLayout>;
}
