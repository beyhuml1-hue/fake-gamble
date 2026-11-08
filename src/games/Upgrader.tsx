import { useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { EDGE } from "../lib/math";
import { betCents, formatMult, payout } from "../lib/money";
import { random } from "../lib/random";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";

const SPIN_MS = 2600;

export function Upgrader() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [target, setTarget] = useState(2);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [win, setWin] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  const chance = (1 - EDGE) / target;
  const cents = Math.round(amount * 100);
  const profit = Math.max(0, payout(Math.max(cents, 0), target) - Math.max(cents, 0));

  const play = () => {
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    setWin(null);
    const roll = luckOn() ? chance * 0.25 : random();
    const didWin = roll < chance;
    const pay = didWin ? payout(stake, target) : 0;
    const land = 1440 + roll * 360;
    setSpinning(false);
    setAngle((current) => current % 360);
    window.setTimeout(() => {
      setSpinning(true);
      setAngle(land);
    }, 30);
    window.setTimeout(() => {
      if (pay) credit(pay);
      record("Upgrader", stake, pay);
      setWin(didWin);
      setSpinning(false);
    }, SPIN_MS + 40);
  };

  return (
    <GameLayout
      title="Upgrader"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={profit}
          label="Upgrade"
          onAction={play}
          disabled={spinning}
          error={error}
        >
          <label className="field">
            <span className="field-label">Target {formatMult(target)}</span>
            <input
              className="range"
              type="range"
              min={1.2}
              max={20}
              step={0.1}
              value={target}
              disabled={spinning}
              onChange={(event) => setTarget(Number(event.target.value))}
            />
          </label>
        </BetPanel>
      }
    >
      <div className="center-stage">
        <div className="dial">
          <div
            className="dial-face"
            style={{ background: `conic-gradient(#00e701 0 ${chance * 360}deg, #2f4553 ${chance * 360}deg 360deg)` }}
          />
          <div className={spinning ? "needle spin" : "needle"} style={{ transform: `rotate(${angle}deg)` }} />
          <div className="dial-hub" />
        </div>
        <div className="stat-row">
          <div className="stat">
            <span>Chance</span>
            <strong>{(chance * 100).toFixed(2)}%</strong>
          </div>
          <div className="stat">
            <span>Target</span>
            <strong>{formatMult(target)}</strong>
          </div>
          <div className="stat">
            <span>Zone</span>
            <strong>Green</strong>
          </div>
        </div>
        <p className={win == null ? "result-line" : win ? "result-line win" : "result-line lose"}>
          {spinning ? "Rolling…" : win == null ? "Green hits. The rest misses." : win ? `Upgraded ${formatMult(target)}` : "Miss"}
        </p>
      </div>
    </GameLayout>
  );
}
