import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents, formatMult, payout } from "../lib/money";
import { limboResult } from "../lib/math";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";

export function Limbo() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [target, setTarget] = useState(2);
  const [shown, setShown] = useState(1);
  const [win, setWin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const safeTarget = Math.min(1_000_000, Math.max(1.01, target || 1.01));
  const cents = Math.round(amount * 100);
  const profit = Math.max(0, payout(Math.max(cents, 0), safeTarget) - Math.max(cents, 0));

  const play = () => {
    const stake = betCents(amount, balance);
    if (stake == null || target < 1.01) {
      setError("Set a target of at least 1.01× and a bet you can cover.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    setBusy(true);
    setWin(null);
    const rolled = limboResult();
    const result = luckOn() ? Math.max(rolled, safeTarget) : rolled;
    const didWin = result >= safeTarget;
    const pay = didWin ? payout(stake, safeTarget) : 0;
    if (pay) credit(pay);
    record("Limbo", stake, pay);
    const start = performance.now();
    const step = (now: number) => {
      if (!live.current) return;
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - t) ** 3;
      setShown(1 + (result - 1) * eased);
      if (t < 1) requestAnimationFrame(step);
      else {
        setWin(didWin);
        setBusy(false);
      }
    };
    requestAnimationFrame(step);
  };

  return (
    <GameLayout
      title="Limbo"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={profit}
          label="Bet"
          onAction={play}
          disabled={busy}
          error={error}
        />
      }
    >
      <div className="center-stage">
        <div className={busy ? "readout live" : win == null ? "readout" : win ? "readout win pop" : "readout lose pop"}>{formatMult(shown)}</div>
        <label className="field limbo-field">
          <span className="field-label">Target multiplier</span>
          <span className="amount">
            <input
              inputMode="decimal"
              aria-label="Target multiplier"
              value={Number.isFinite(target) ? String(target) : ""}
              onChange={(event) => {
                const next = Number(event.target.value);
                setTarget(Number.isFinite(next) ? next : 1.01);
              }}
              onBlur={() => setTarget(safeTarget)}
            />
            <span className="amount-suffix">×</span>
          </span>
        </label>
        <input
          className="range"
          type="range"
          min={1.01}
          max={100}
          step={0.01}
          value={Math.min(100, safeTarget)}
          onChange={(event) => setTarget(Number(event.target.value))}
        />
      </div>
    </GameLayout>
  );
}
