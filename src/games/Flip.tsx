import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents, formatUSD, payout } from "../lib/money";
import { EDGE } from "../lib/math";
import { random } from "../lib/random";
import { luckOn } from "../lib/luck";
import { sound } from "../lib/sound";
import { useWallet } from "../state/wallet";

const MULT = 2 * (1 - EDGE);
const FLIP_MS = 1700;

type Pending = { stake: number; pay: number; win: boolean; heads: boolean };

export function Flip() {
  const { balance, debit, credit, record, setOpenFlip } = useWallet();
  const [amount, setAmount] = useState(1);
  const [side, setSide] = useState<"heads" | "tails">("heads");
  const [deg, setDeg] = useState(0);
  const [busy, setBusy] = useState(false);
  const [win, setWin] = useState<boolean | null>(null);
  const [landed, setLanded] = useState<"heads" | "tails" | null>(null);
  const [paid, setPaid] = useState(0);
  const [error, setError] = useState("");
  const pending = useRef<Pending | null>(null);
  const timer = useRef(0);
  const creditRef = useRef(credit);
  const recordRef = useRef(record);
  creditRef.current = credit;
  recordRef.current = record;

  const settle = () => {
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    setOpenFlip(null);
    if (job.pay) creditRef.current(job.pay);
    recordRef.current("Flip", job.stake, job.pay);
    setWin(job.win);
    setLanded(job.heads ? "heads" : "tails");
    setPaid(job.pay);
    setBusy(false);
  };

  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current);
      const job = pending.current;
      if (!job) return;
      pending.current = null;
      setOpenFlip(null);
      if (job.pay) creditRef.current(job.pay);
      recordRef.current("Flip", job.stake, job.pay);
    };
  }, [setOpenFlip]);

  const cents = Math.round(amount * 100);
  const profit = Math.max(0, payout(Math.max(cents, 0), MULT) - Math.max(cents, 0));

  const play = () => {
    if (pending.current) return;
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Bet at least $0.10 and no more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    setOpenFlip({ wager: stake, side, at: Date.now() });
    setBusy(true);
    setWin(null);
    setLanded(null);
    sound.flip();
    const heads = luckOn() ? side === "heads" : random() < 0.5;
    const didWin = (heads && side === "heads") || (!heads && side === "tails");
    const pay = didWin ? payout(stake, MULT) : 0;
    pending.current = { stake, pay, win: didWin, heads };
    const turns = 6 + Math.floor(random() * 2);
    const landing = heads ? 0 : 180;
    setDeg((prev) => Math.ceil(prev / 360) * 360 + turns * 360 + landing);
    window.clearTimeout(timer.current);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : FLIP_MS;
    timer.current = window.setTimeout(settle, delay);
  };

  const result = landed === "heads" ? "Heads" : "Tails";
  const line = busy ? "Flipping…" : landed
    ? `${result} · ${win ? formatUSD(paid) + " payout" : "No payout"}`
    : `Pick a side. A correct guess pays ${MULT.toFixed(2)}×.`;

  return (
    <GameLayout
      title="Flip"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={profit}
          label="Flip"
          onAction={play}
          disabled={busy}
          locked={busy}
          error={error}
        >
          <div className="field">
            <span className="field-label">Pick a side</span>
            <div className="select" role="group" aria-label="Coin side">
              <button type="button" className={side === "heads" ? "on" : ""} aria-pressed={side === "heads"} disabled={busy} onClick={() => setSide("heads")}>
                Heads
              </button>
              <button type="button" className={side === "tails" ? "on" : ""} aria-pressed={side === "tails"} disabled={busy} onClick={() => setSide("tails")}>
                Tails
              </button>
            </div>
          </div>
        </BetPanel>
      }
    >
      <div className="center-stage">
        <div className="coin-scene" aria-hidden="true">
          <div className={busy ? "coin flipping" : "coin"} style={{ transform: `rotateY(${deg}deg)` }}>
            <div className="coin-face coin-heads">
              <span>Heads</span>
              <svg viewBox="0 0 64 64" focusable="false">
                <path d="M15 54c2-6 7-10 13-12v-6c-4-3-7-8-7-14 0-10 6-16 16-16 9 0 15 6 15 15v4l5 9h-6l-1 6c-1 3-3 4-7 4h-3v5c5 1 10 4 12 8H14z" />
              </svg>
              <small>BlockBet</small>
            </div>
            <div className="coin-face coin-tails">
              <span>Tails</span>
              <svg viewBox="0 0 64 64" focusable="false">
                <path d="m32 4 7 19 20 1-16 13 6 20-17-12-17 12 6-20L5 24l20-1z" />
              </svg>
              <small>BlockBet</small>
            </div>
          </div>
        </div>
        <p role="status" className={win == null ? "result-line" : win ? "result-line win" : "result-line lose"}>{line}</p>
      </div>
    </GameLayout>
  );
}
