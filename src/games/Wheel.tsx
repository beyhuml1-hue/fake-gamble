import { useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { WHEELS, type Risk } from "../lib/math";
import { betCents, formatMult, payout } from "../lib/money";
import { randInt } from "../lib/random";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";

export function Wheel() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [risk, setRisk] = useState<Risk>("medium");
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [win, setWin] = useState<number | null>(null);
  const [error, setError] = useState("");

  const segments = WHEELS[risk];
  const top = Math.max(...segments);
  const cents = Math.round(amount * 100);
  const profit = Math.max(0, payout(Math.max(cents, 0), top) - Math.max(cents, 0));
  const slice = 360 / segments.length;
  const gradient = `conic-gradient(${segments
    .map((mult, i) => {
      const color = mult <= 0 ? "#1a2c38" : mult < 2 ? "#1475e1" : mult < 8 ? "#00e701" : "#ffbf39";
      return `${color} ${i * slice}deg ${(i + 1) * slice}deg`;
    })
    .join(",")})`;

  const spin = () => {
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    setBusy(true);
    setWin(null);
    let index = randInt(segments.length);
    if (luckOn()) {
      index = 0;
      segments.forEach((mult, i) => {
        if (mult > (segments[index] ?? 0)) index = i;
      });
    }
    const mult = segments[index] ?? 0;
    const pay = payout(stake, mult);
    if (pay) credit(pay);
    record("Wheel", stake, pay);
    const center = index * slice + slice / 2;
    setRotation((prev) => {
      const base = Math.ceil(prev / 360) * 360 + 360 * 5;
      return base + (360 - center);
    });
    window.setTimeout(() => {
      setWin(mult);
      setBusy(false);
    }, 3100);
  };

  return (
    <GameLayout
      title="Wheel"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={profit}
          label="Bet"
          onAction={spin}
          disabled={busy}
          error={error}
        >
          <div className="field">
            <span className="field-label">Risk</span>
            <div className="select">
              {(["low", "medium", "high"] as Risk[]).map((item) => (
                <button key={item} type="button" className={risk === item ? "on" : ""} disabled={busy} onClick={() => setRisk(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <p className="hint">Profit shows the top segment, {formatMult(top)}.</p>
        </BetPanel>
      }
    >
      <div className={busy ? "wheel-scene spinning" : "wheel-scene"}>
        <div className="pointer" />
        <div className="wheel-disc" style={{ background: gradient, transform: `rotate(${rotation}deg)` }}>
          {segments.map((mult, i) => (
            <span key={`${risk}-${i}`} style={{ transform: `rotate(${i * slice + slice / 2}deg)` }}>
              {mult >= 10 ? mult.toFixed(0) : mult.toFixed(1)}
            </span>
          ))}
        </div>
        <p className={win == null ? "result-line" : win > 0 ? "result-line win" : "result-line lose"}>
          {win == null ? "Spin" : formatMult(win)}
        </p>
      </div>
    </GameLayout>
  );
}
