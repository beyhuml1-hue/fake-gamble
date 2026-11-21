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
  | { kind: "dozen"; d: 1 | 2 | 3 };

function multFor(bet: Bet): number {
  if (bet.kind === "straight") return 36;
  if (bet.kind === "dozen") return 3;
  return 2;
}

function wins(bet: Bet, n: number): boolean {
  if (n === 0) return bet.kind === "straight" && bet.n === 0;
  if (bet.kind === "straight") return bet.n === n;
  if (bet.kind === "color") return (RED.has(n) ? "red" : "black") === bet.color;
  if (bet.kind === "parity") return (n % 2 === 0) === bet.even;
  if (bet.kind === "half") return bet.low ? n <= 18 : n >= 19;
  if (bet.kind === "dozen") return n >= (bet.d - 1) * 12 + 1 && n <= bet.d * 12;
  return false;
}

function forcedNumber(bet: Bet): number {
  if (bet.kind === "straight") return bet.n;
  if (bet.kind === "color") return bet.color === "red" ? 1 : 2;
  if (bet.kind === "parity") return bet.even ? 2 : 1;
  if (bet.kind === "half") return bet.low ? 1 : 19;
  return bet.d === 1 ? 1 : bet.d === 2 ? 13 : 25;
}

function label(bet: Bet | null): string {
  if (!bet) return "Pick a pocket";
  if (bet.kind === "straight") return bet.n === 0 ? "0" : String(bet.n);
  if (bet.kind === "color") return bet.color;
  if (bet.kind === "parity") return bet.even ? "Even" : "Odd";
  if (bet.kind === "half") return bet.low ? "1–18" : "19–36";
  return `${bet.d}${bet.d === 1 ? "st" : bet.d === 2 ? "nd" : "rd"} 12`;
}

export function Roulette() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [bet, setBet] = useState<Bet | null>({ kind: "color", color: "red" });
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

  const mult = bet ? multFor(bet) : 0;
  const cents = Math.round(amount * 100);
  const profit = Math.max(0, payout(Math.max(cents, 0), mult) - Math.max(cents, 0));

  const spin = () => {
    if (spinLock.current) return;
    if (!bet) {
      setError("Choose a bet on the table.");
      return;
    }
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    spinLock.current=true;
    setBusy(true);
    sound.roll();
    setResult(null);
    const n = luckOn() ? forcedNumber(bet) : ORDER[randInt(ORDER.length)]!;
    const didWin = wins(bet, n);
    const pay = didWin ? payout(stake, multFor(bet)) : 0;
    const index = ORDER.indexOf(n);
    const center = index * slice + slice / 2;
    setRotation((prev) => Math.ceil(prev / 360) * 360 + 360 * 5 + (360 - center));
    window.setTimeout(() => {
      if (pay) credit(pay);
      record("Roulette", stake, pay);
      setResult(n);
      setWin(didWin);
      setRecent(prior=>[n,...prior].slice(0,20));
      spinLock.current=false;
      setBusy(false);
    }, 3100);
  };

  const numbers = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35, 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];

  return (
    <GameLayout
      title="Roulette"
      note="97.30% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={profit}
          label="Bet"
          onAction={spin}
          disabled={busy}
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
            On {label(bet)} · pays {formatUSD(profit)} profit
          </p>
        </BetPanel>
      }
    >
      <div className="roulette premium-roulette">
        <div className="roulette-history" aria-label="Recent roulette results">{recent.length?recent.map((n,i)=><span key={i} data-red={RED.has(n)} data-zero={n===0}>{n}</span>):<small>No recent rounds</small>}</div>
        <div className={busy ? "wheel-scene compact spinning" : "wheel-scene compact"}>
          <div className="pointer" />
          <span className={busy?"roulette-ball is-rolling":"roulette-ball"} aria-hidden="true" />
          <div className="wheel-disc small" style={{ background: gradient, transform: `rotate(${rotation}deg)` }}>
            {ORDER.map((n,i)=><span key={n} className="roulette-pocket-label" data-winner={result===n&&!busy} style={{"--pocket-angle":`${(i+0.5)*slice}deg`} as CSSProperties}><b>{n}</b></span>)}
            <span className="roulette-wheel-hub" aria-live="polite"><small>{busy?"Rolling":result!==null?"Round over":"Place your bet"}</small><b>{busy?"●":result!==null?result:"—"}</b></span>
          </div>
          <p className={win == null ? "result-line" : win ? "result-line win" : "result-line lose"}>
            {result == null ? "European wheel" : result === 0 ? "0" : `${result} ${RED.has(result) ? "red" : "black"}`}
          </p>
        </div>
        <fieldset className="felt" disabled={busy} aria-label="Roulette bets">
          <button
            type="button"
            className={bet?.kind === "straight" && bet.n === 0 ? "zero on" : "zero"}
            onClick={() => setBet({ kind: "straight", n: 0 })}
          >
            0
          </button>
          <div className="pockets">
            {numbers.map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy}
                data-winner={result===n&&!busy}
                className={`pocket ${RED.has(n) ? "red" : "black"} ${bet?.kind === "straight" && bet.n === n ? "on" : ""}`}
                onClick={() => setBet({ kind: "straight", n })}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="outside">
            <button type="button" className={bet?.kind === "half" && bet.low ? "on" : ""} onClick={() => setBet({ kind: "half", low: true })}>
              1–18
            </button>
            <button type="button" className={bet?.kind === "parity" && bet.even ? "on" : ""} onClick={() => setBet({ kind: "parity", even: true })}>
              Even
            </button>
            <button type="button" className={bet?.kind === "color" && bet.color === "red" ? "on red" : "red"} onClick={() => setBet({ kind: "color", color: "red" })}>
              Red
            </button>
            <button type="button" className={bet?.kind === "color" && bet.color === "black" ? "on" : ""} onClick={() => setBet({ kind: "color", color: "black" })}>
              Black
            </button>
            <button type="button" className={bet?.kind === "parity" && !bet.even ? "on" : ""} onClick={() => setBet({ kind: "parity", even: false })}>
              Odd
            </button>
            <button type="button" className={bet?.kind === "half" && !bet.low ? "on" : ""} onClick={() => setBet({ kind: "half", low: false })}>
              19–36
            </button>
          </div>
          <div className="outside dozens">
            {[1, 2, 3].map((d) => (
              <button key={d} type="button" className={bet?.kind === "dozen" && bet.d === d ? "on" : ""} onClick={() => setBet({ kind: "dozen", d: d as 1 | 2 | 3 })}>
                {d === 1 ? "1st 12" : d === 2 ? "2nd 12" : "3rd 12"}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </GameLayout>
  );
}
