import { useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents, payout } from "../lib/money";
import { EDGE } from "../lib/math";
import { random } from "../lib/random";
import { useWallet } from "../state/wallet";

const MULT = 2 * (1 - EDGE);

export function Flip() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [side, setSide] = useState<"heads" | "tails">("heads");
  const [deg, setDeg] = useState(0);
  const [busy, setBusy] = useState(false);
  const [win, setWin] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  const cents = Math.round(amount * 100);
  const profit = Math.max(0, payout(Math.max(cents, 0), MULT) - Math.max(cents, 0));

  const play = () => {
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    setBusy(true);
    const heads = random() < 0.5;
    const didWin = (heads && side === "heads") || (!heads && side === "tails");
    const pay = didWin ? payout(stake, MULT) : 0;
    if (pay) credit(pay);
    record("Flip", stake, pay);
    setWin(didWin);
    const turns = 5 + Math.floor(random() * 3);
    const landing = heads ? 0 : 180;
    setDeg((prev) => {
      const base = Math.ceil(prev / 360) * 360 + turns * 360;
      return base + landing;
    });
    window.setTimeout(() => setBusy(false), 900);
  };

  return (
    <GameLayout
      title="Flip"
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
        >
          <div className="field">
            <span className="field-label">Pick a side</span>
            <div className="select">
              <button type="button" className={side === "heads" ? "on" : ""} disabled={busy} onClick={() => setSide("heads")}>
                Heads
              </button>
              <button type="button" className={side === "tails" ? "on" : ""} disabled={busy} onClick={() => setSide("tails")}>
                Tails
              </button>
            </div>
          </div>
        </BetPanel>
      }
    >
      <div className="center-stage">
        <div className="coin-scene">
          <div className="coin" style={{ transform: `rotateY(${deg}deg)` }}>
            <div className="face heads">H</div>
            <div className="face tails">T</div>
          </div>
        </div>
        <p className={win == null ? "result-line" : win ? "result-line win" : "result-line lose"}>
          {win == null ? `${MULT.toFixed(2)}× on a correct call` : win ? "Win" : "Miss"}
        </p>
      </div>
    </GameLayout>
  );
}
