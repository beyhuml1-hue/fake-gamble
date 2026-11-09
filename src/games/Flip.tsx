import { useEffect, useRef, useState } from "react";
import { ReferenceGoldCoin } from "../components/ReferenceGoldCoin";
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
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [side, setSide] = useState<"heads" | "tails">("heads");
  const [deg, setDeg] = useState(0);
  const [busy, setBusy] = useState(false);
  const [win, setWin] = useState<boolean | null>(null);
  const [landed, setLanded] = useState<"heads" | "tails" | null>(null);
  const [paid, setPaid] = useState(0);
  const [lastStake, setLastStake] = useState(0);
  const [resultId, setResultId] = useState(0);
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
    if (job.pay) creditRef.current(job.pay);
    recordRef.current("Flip", job.stake, job.pay);
    setWin(job.win);
    setLanded(job.heads ? "heads" : "tails");
    setPaid(job.pay);
    setLastStake(job.stake);
    setResultId((value) => value + 1);
    setBusy(false);
  };

  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current);
      const job = pending.current;
      if (!job) return;
      pending.current = null;
      if (job.pay) creditRef.current(job.pay);
      recordRef.current("Flip", job.stake, job.pay);
    };
  }, []);

  const cents = Math.round(amount * 100);
  const profit = Math.max(0, payout(Math.max(cents, 0), MULT) - Math.max(cents, 0));

  // Choosing TAILS shows the back of the original gold coin immediately.
  // Idle face changes are instant; only an actual bet triggers a spin.
  const chooseSide = (next: "heads" | "tails") => {
    if (busy) return;
    setSide(next);
    setWin(null);
    setLanded(null);
    setPaid(0);
    setDeg((previous) => Math.floor(previous / 360) * 360 + (next === "tails" ? 180 : 0));
  };

  const play = () => {
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
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
    timer.current = window.setTimeout(settle, FLIP_MS);
  };

  const line =
    busy || landed == null
      ? busy
        ? "Flipping…"
        : `${MULT.toFixed(2)}× if you call it`
      : win
        ? `${landed === "heads" ? "Heads" : "Tails"} · ${formatUSD(paid)}`
        : `${landed === "heads" ? "Heads" : "Tails"} · miss`;

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
            <div className="select">
              <button type="button" className={side === "heads" ? "on" : ""} disabled={busy} onClick={() => chooseSide("heads")}>
                Heads
              </button>
              <button type="button" className={side === "tails" ? "on" : ""} disabled={busy} onClick={() => chooseSide("tails")}>
                Tails
              </button>
            </div>
          </div>
        </BetPanel>
      }
    >
      <div className="center-stage">
        <div className="flip-coin-display">
          <ReferenceGoldCoin degrees={deg} spinning={busy} />
          <div className="flip-feedback-slot" aria-live="polite" aria-atomic="true">
            {win !== null && landed !== null && !busy && (
              <div key={resultId} className={win ? "flip-outcome flip-win" : "flip-outcome flip-loss"}>
                {win && (
                  <div className="flip-sparks" aria-hidden="true">
                    {Array.from({ length: 9 }, (_, i) => <i key={i} />)}
                  </div>
                )}
                <span className="flip-outcome-emblem" aria-hidden="true">{win ? "✦" : "×"}</span>
                <strong className="flip-outcome-mult">{win ? `${(paid / lastStake).toFixed(2)}×` : "0.00×"}</strong>
                <span className="flip-outcome-details">{win ? `WIN · ${formatUSD(paid)} payout` : `LOSS · ${formatUSD(lastStake)} wager`}</span>
              </div>
            )}
          </div>
        </div>
        <p className={win == null ? "result-line" : win ? "result-line win" : "result-line lose"}>{line}</p>
      </div>
    </GameLayout>
  );
}
