import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents, payout } from "../lib/money";
import { chanceMultiplier } from "../lib/math";
import { random } from "../lib/random";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";

const DIE_FACE = [
  "",
  "rotateX(0deg) rotateY(0deg)",
  "rotateY(-90deg)",
  "rotateX(-90deg)",
  "rotateX(90deg)",
  "rotateY(90deg)",
  "rotateY(180deg)",
];

const DIE_FACE_LABELS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function Dice() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [chance, setChance] = useState(50);
  const [mode, setMode] = useState<"under" | "over">("under");
  const [shown, setShown] = useState(50);
  const [face, setFace] = useState(1);
  const [win, setWin] = useState<boolean | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState("");
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const mult = chanceMultiplier(chance);
  const cents = Math.round(amount * 100);
  const profit = Math.max(0, payout(Math.max(cents, 0), mult) - Math.max(cents, 0));
  const line = mode === "under" ? chance : 100 - chance;

  const roll = () => {
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    setSpinning(true);
    setWin(null);
    let result = random() * 100;
    if (luckOn()) result = mode === "under" ? chance * 0.45 : 100 - chance * 0.45;
    const didWin = mode === "under" ? result < chance : result > 100 - chance;
    const pay = didWin ? payout(stake, mult) : 0;
    if (pay) credit(pay);
    record("Dice", stake, pay);
    const from = shown;
    const start = performance.now();
    const step = (now: number) => {
      if (!live.current) return;
      const t = Math.min(1, (now - start) / 860);
      const wobble = (1 - t) ** 2;
      const noise = (random() - 0.5) * 64 * wobble;
      const eased = from + (result - from) * (1 - (1 - t) ** 3);
      setShown(t < 1 ? eased + noise : result);
      if (t < 1) requestAnimationFrame(step);
      else {
        setFace(Math.min(6, 1 + Math.floor(result / (100 / 6))));
        setWin(didWin);
        setSpinning(false);
      }
    };
    requestAnimationFrame(step);
  };

  return (
    <GameLayout
      title="Dice"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={profit}
          label="Bet"
          onAction={roll}
          disabled={spinning}
          error={error}
        />
      }
    >
      <div className="dice-layout">
        <div className="die-scene" aria-hidden="true">
          <div
            className={spinning ? "die tumble" : "die"}
            style={{ transform: spinning ? undefined : DIE_FACE[face] }}
          >
            {DIE_FACE_LABELS.map((label, index) => (
              <span key={label} className={`die-face f${index + 1}`}>
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className={spinning ? "readout spin" : win == null ? "readout" : win ? "readout win pop" : "readout lose pop"}>
          {shown.toFixed(2)}
        </div>
        <div className="stat-row">
          <div className="stat">
            <span>Multiplier</span>
            <strong>{mult.toFixed(4)}×</strong>
          </div>
          <div className="stat">
            <span>{mode === "under" ? "Roll under" : "Roll over"}</span>
            <strong>{line.toFixed(2)}</strong>
          </div>
          <div className="stat">
            <span>Win chance</span>
            <strong>{chance.toFixed(2)}%</strong>
          </div>
        </div>
        <input
          className="range dice-range"
          type="range"
          min={2}
          max={98}
          value={chance}
          aria-label="Win chance"
          style={{
            background:
              mode === "under"
                ? `linear-gradient(90deg, #00e701 ${chance}%, #2f4553 ${chance}%)`
                : `linear-gradient(90deg, #2f4553 ${100 - chance}%, #00e701 ${100 - chance}%)`,
          }}
          onChange={(event) => setChance(Number(event.target.value))}
        />
        <div className="select">
          <button type="button" className={mode === "under" ? "on" : ""} onClick={() => setMode("under")}>
            Roll under
          </button>
          <button type="button" className={mode === "over" ? "on" : ""} onClick={() => setMode("over")}>
            Roll over
          </button>
        </div>
      </div>
    </GameLayout>
  );
}
