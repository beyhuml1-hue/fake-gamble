import { useState, type PointerEvent } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { EDGE } from "../lib/math";
import { betCents, formatMult, payout } from "../lib/money";
import { random } from "../lib/random";
import { useWallet } from "../state/wallet";

const SPIN_MS = 2600;

export function Upgrader() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [target, setTarget] = useState(2);
  const [angle, setAngle] = useState(0);
  const [zone, setZone] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [win, setWin] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  const chance = (1 - EDGE) / target;
  const cents = Math.round(amount * 100);
  const profit = Math.max(0, payout(Math.max(cents, 0), target) - Math.max(cents, 0));

  const play = () => {
    if (spinning) return;
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    setWin(null);
    const roll = random();
    const didWin = roll < chance;
    const pay = didWin ? payout(stake, target) : 0;
    const landing = (zone + roll * 360) % 360;
    setSpinning(true);
    setAngle(current => current + 1440 + ((landing - current % 360 + 360) % 360));
    window.setTimeout(() => {
      if (pay) credit(pay);
      record("Upgrader", stake, pay);
      setWin(didWin);
      setSpinning(false);
    }, SPIN_MS + 40);
  };

  function moveZone(event: PointerEvent<HTMLDivElement>) {
    if (spinning) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left - box.width / 2;
    const y = event.clientY - box.top - box.height / 2;
    if (Math.hypot(x, y) < box.width * .24) return;
    setZone((Math.round(Math.atan2(x, -y) * 180 / Math.PI) + 360) % 360);
  }

  return (
    <GameLayout
      title="Upgrader"
      note="98% base RTP"
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
              step={0.01}
              value={target}
              disabled={spinning}
              onChange={(event) => setTarget(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span className="field-label">Winning zone position</span>
            <input className="range" type="range" min={0} max={359} value={zone} disabled={spinning}
              onChange={event => setZone(Number(event.target.value))} />
          </label>
        </BetPanel>
      }
    >
      <div className="center-stage">
        <div className="upgrade-wheel"
          onPointerDown={event => { if (!spinning && event.button === 0) {
            event.currentTarget.setPointerCapture(event.pointerId);
            moveZone(event);
          } }}
          onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveZone(event); }}>
          <div className="upgrade-rim" style={{ background: `conic-gradient(from ${zone}deg, #68efa0 0 ${chance * 360}deg, #393d56 ${chance * 360}deg 360deg)` }} />
          <div className="upgrade-wheel-center"><img src="/covers/slide/gold.png" alt="" /></div>
          <div className="upgrade-marker" style={{ transform: `rotate(${angle}deg)`,
            transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.13,.65,.2,1)` : "none" }} />
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
        </div>
        <p className={win == null ? "result-line" : win ? "result-line win" : "result-line lose"}>
          {spinning ? "Rolling…" : win == null ? "Drag the rim to move the winning zone." : win ? `Upgraded ${formatMult(target)}` : "Miss"}
        </p>
      </div>
    </GameLayout>
  );
}
