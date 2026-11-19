import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents, formatMult, payout } from "../lib/money";
import { limboResult } from "../lib/math";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";
import "./motion-upgrades.css";

export function Limbo() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [target, setTarget] = useState(2);
  const [shown, setShown] = useState(1);
  const [win, setWin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const live = useRef(true);
  const frame = useRef(0);
  const running = useRef(false);
  const [round,setRound] = useState(0);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      cancelAnimationFrame(frame.current);
    };
  }, []);

  const safeTarget = Math.min(1_000_000, Math.max(1.01, target || 1.01));
  const cents = Math.round(amount * 100);
  const profit = Math.max(0, payout(Math.max(cents, 0), safeTarget) - Math.max(cents, 0));

  const play = () => {
    const stake = betCents(amount, balance);
    if (running.current || busy || stake == null || !Number.isFinite(target) || target < 1.01 || target > 1_000_000) {
      setError("Set a target of at least 1.01× and a bet you can cover.");
      return;
    }
    if (!debit(stake)) return;
    running.current = true;
    setRound(previous=>previous+1);
    setError("");
    setBusy(true);
    setWin(null);
    const rolled = limboResult();
    const result = luckOn() ? Math.max(rolled, safeTarget) : rolled;
    const didWin = result >= safeTarget;
    const pay = didWin ? payout(stake, safeTarget) : 0;
    const credited = pay ? credit(pay) : 0;
    record("Limbo", stake, credited);
    const start = performance.now();
    const step = (now: number) => {
      if (!live.current) return;
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - t) ** 3;
      setShown(1 + (result - 1) * eased);
      if (t < 1) frame.current=requestAnimationFrame(step);
      else {
        setWin(didWin);
        setBusy(false);
        running.current = false;
      }
    };
    frame.current=requestAnimationFrame(step);
  };

  return (
    <GameLayout
      title="Limbo"
      note="98% base RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={profit}
          label={busy ? "Rolling…" : "Bet"}
          onAction={play}
          disabled={busy}
          error={error}
          locked={busy}
        />
      }
    >
      <div className={"center-stage limbo-flight "+(busy?"is-flying":win===true?"flight-won":win===false?"flight-lost":"")} data-round={round}>
        <div className="limbo-sky" aria-hidden="true">
          <i/><i/><i/><i/><i/>
          <div className="limbo-target-line"><span>{formatMult(safeTarget)}</span></div>
          <div className="limbo-rocket" key={round}><span className="rocket-nose"/><span className="rocket-body"/><span className="rocket-fin left"/><span className="rocket-fin right"/><span className="rocket-flame"/></div>
        </div>
        <div className={busy ? "readout live" : win == null ? "readout" : win ? "readout win pop" : "readout lose pop"}>{formatMult(shown)}</div>
        <div className="limbo-bottom-controls"><label className="field limbo-field">
          <span className="field-label">Target multiplier</span>
          <span className="amount">
            <input
              inputMode="decimal"
              aria-label="Target multiplier"
              disabled={busy}
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
        <label className="field limbo-field"><span className="field-label">Win chance</span><span className="amount"><input
          aria-label="Win chance" inputMode="decimal" disabled={busy} value={(99/safeTarget).toFixed(2)}
          onChange={event=>{const chance=Number(event.target.value);if(Number.isFinite(chance)&&chance>0)setTarget(99/chance);}}/><span className="amount-suffix">%</span></span></label>
        </div>
        <input
          className="range"
          type="range"
          min={1.01}
          max={100}
          step={0.01}
          value={Math.min(100, safeTarget)}
          disabled={busy}
          onChange={(event) => setTarget(Number(event.target.value))}
        />
      </div>
    </GameLayout>
  );
}
