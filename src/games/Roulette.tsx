import { useMemo, useRef, useState, type CSSProperties } from "react";
import { sound } from "../lib/sound";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents, formatUSD, payout } from "../lib/money";
import { randInt } from "../lib/random";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";

const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

type Bet =
  | { kind: "straight"; n: number }
  | { kind: "color"; color: "red" | "black" }
  | { kind: "parity"; even: boolean }
  | { kind: "half"; low: boolean }
  | { kind: "dozen"; d: number }
  | { kind: "column"; column: number };

function multFor(bet: Bet): number {
  if (bet.kind === "straight") return 36;
  if (bet.kind === "dozen" || bet.kind === "column") return 3;
  return 2;
}

function wins(bet: Bet, n: number): boolean {
  if (n === 0) return bet.kind === "straight" && bet.n === 0;
  if (bet.kind === "straight") return bet.n === n;
  if (bet.kind === "color") return (RED.has(n) ? "red" : "black") === bet.color;
  if (bet.kind === "parity") return (n % 2 === 0) === bet.even;
  if (bet.kind === "half") return bet.low ? n <= 18 : n >= 19;
  if (bet.kind === "dozen") return n >= (bet.d - 1) * 12 + 1 && n <= bet.d * 12;
  return bet.kind === "column" && n % 3 === bet.column % 3;
}

export function Roulette() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [chips, setChips] = useState<Record<string, { bet: Bet; cents: number }>>({});
  const placed = Object.values(chips);
  const stake = placed.reduce((total, chip) => total + chip.cents, 0);
  const addChip = (bet: Bet) => {
    if (spinLock.current) return;
    const cents = betCents(amount, balance - stake);
    if (cents == null) { setError("Choose a chip value you can cover."); return; }
    const key = JSON.stringify(bet);
    setChips(previous => {
      const total = Object.values(previous).reduce((sum, chip) => sum + chip.cents, 0);
      if (total + cents > balance) return previous;
      return { ...previous, [key]: { bet, cents: (previous[key]?.cents ?? 0) + cents } };
    });
    setError("");
  };
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [win, setWin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recent,setRecent] = useState<number[]>([]);
  const spinLock = useRef(false);

  const slice = 360 / ORDER.length;
  const gradient = useMemo(
    () =>
      `conic-gradient(${ORDER.map((n, i) => {
        const color = n === 0 ? "#147a3a" : RED.has(n) ? "#e9113c" : "#0b1218";
        return `${color} ${i * slice}deg ${(i + 1) * slice}deg`;
      }).join(",")})`,
    [slice],
  );

  const spin = () => {
    if (spinLock.current || !stake) return;
    if (stake > balance) { setError("Your chips exceed your available balance."); return; }
    if (!debit(stake)) return;
    setError("");
    spinLock.current=true;
    setBusy(true);
    sound.roll();
    setResult(null);
    const n = luckOn() ? ORDER.find(number => wins(placed[0]!.bet, number))! : ORDER[randInt(ORDER.length)]!;
    const pay = placed.reduce((total, chip) => wins(chip.bet, n) ? total + payout(chip.cents, multFor(chip.bet)) : total, 0);
    const index = ORDER.indexOf(n);
    const center = index * slice + slice / 2;
    setRotation((prev) => Math.ceil(prev / 360) * 360 + 360 * 5 + (360 - center));
    window.setTimeout(() => {
      if (pay) credit(pay);
      record("Roulette", stake, pay);
      setResult(n);
      setWin(pay > stake);
      setChips({});
      setRecent(prior=>[n,...prior].slice(0,20));
      spinLock.current=false;
      setBusy(false);
    }, 3100);
  };

  const spot = (bet: Bet, name: string | number, className = "") => {
    const key = JSON.stringify(bet);
    const cents = chips[key]?.cents ?? 0;
    return <button key={key} type="button" className={`${className}${cents ? " on" : ""}`}
      data-winner={result !== null && !busy && bet.kind === "straight" && bet.n === result}
      onClick={() => addChip(bet)}>
      {name}{cents > 0 && <small className="roulette-placed-chip">{formatUSD(cents)}</small>}
    </button>;
  };

  return (
    <GameLayout
      title="Roulette"
      note="97.30% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={0}
          label="Spin"
          onAction={spin}
          disabled={busy || !stake}
          locked={busy}
          error={error}
          amountLabel="Chip value"
          showProfit={false}
        >
          <div className="field"><span className="field-label">Chips</span><div className="roulette-chip-picks">
            {[0.1,0.5,1,5,10,25,100,500,1000,10000,100000,1000000,10000000].map((chip,i)=>
              <button type="button" key={chip} disabled={busy} aria-label={formatUSD(chip*100)+" chip"}
                aria-pressed={chip===amount} style={{"--chip-color":["#28659a","#258259","#7651a5","#aa762d","#a5454e"][i%5]} as CSSProperties}
                onClick={()=>setAmount(chip)}>{chip>=1000000?chip/1000000+"M":chip>=1000?chip/1000+"K":chip}</button>)}
          </div></div>
          <p className="hint">
            On table {formatUSD(stake)}
          </p>
          <button className="ghost-btn" type="button" onClick={() => setChips({})} disabled={busy || !stake}>Clear chips</button>
        </BetPanel>
      }
    >
      <div className="roulette premium-roulette">
        <div className="roulette-history" aria-label="Recent roulette results">{recent.length?recent.map((n,i)=><span key={i} data-red={RED.has(n)} data-zero={n===0}>{n}</span>):<small>No recent rounds</small>}</div>
        <div className={busy ? "wheel-scene compact spinning" : "wheel-scene compact"}>
          <div className="pointer" />
          <div className="roulette-orbit" data-spinning={busy} aria-hidden="true"><i /></div>
          <div className="wheel-disc small" style={{ background: gradient, transform: `rotate(${rotation}deg)` }}>
            {ORDER.map((n,i)=><span key={n} className="roulette-pocket-label" data-winner={result===n&&!busy} style={{"--pocket-angle":`${(i+0.5)*slice}deg`} as CSSProperties}><b>{n}</b></span>)}
            <span className="roulette-wheel-hub" aria-live="polite"><small>{busy?"Rolling":result!==null?"Round over":"Place your bet"}</small><b>{busy?"●":result!==null?result:"—"}</b></span>
          </div>
          <p className={win == null ? "result-line" : win ? "result-line win" : "result-line lose"}>
            {result == null ? "European wheel" : result === 0 ? "0" : `${result} ${RED.has(result) ? "red" : "black"}`}
          </p>
        </div>
        <fieldset className="felt" disabled={busy} aria-label="Roulette bets">
          {spot({ kind: "straight", n: 0 }, 0, "zero pocket")}
          <div className="pockets roulette-table-grid">
            {[3, 2, 1].flatMap(column => [
              ...Array.from({ length: 12 }, (_, i) => {
                const n = column + i * 3;
                return spot({ kind: "straight", n }, n, `pocket ${RED.has(n) ? "red" : "black"}`);
              }),
              spot({ kind: "column", column }, "2 to 1", "pocket roulette-column"),
            ])}
          </div>
          <div className="outside dozens">
            {[1, 2, 3].map(d => spot({ kind: "dozen", d }, `${d === 1 ? "1st" : d === 2 ? "2nd" : "3rd"} 12`))}
          </div>
          <div className="outside">
            {spot({ kind: "half", low: true }, "1–18")}
            {spot({ kind: "parity", even: true }, "Even")}
            {spot({ kind: "color", color: "red" }, "Red", "red")}
            {spot({ kind: "color", color: "black" }, "Black")}
            {spot({ kind: "parity", even: false }, "Odd")}
            {spot({ kind: "half", low: false }, "19–36")}
          </div>
        </fieldset>
      </div>
    </GameLayout>
  );
}
