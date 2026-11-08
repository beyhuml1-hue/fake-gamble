import { useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { DIAMOND_LABEL, DIAMOND_PAY, diamondHand } from "../lib/math";
import { betCents, payout } from "../lib/money";
import { randInt } from "../lib/random";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#22d3ee", "#3b82f6", "#c084fc"];

export function Diamonds() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [gems, setGems] = useState<number[]>([0, 1, 2, 3, 4]);
  const [label, setLabel] = useState("Five gems. Pairs pay.");
  const [win, setWin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const top = Math.max(...Object.values(DIAMOND_PAY));
  const cents = Math.round(amount * 100);
  const profit = Math.max(0, payout(Math.max(cents, 0), top) - Math.max(cents, 0));

  const play = () => {
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    setBusy(true);
    const drawn = luckOn() ? [0, 0, 0, 0, 1] : Array.from({ length: 5 }, () => randInt(7));
    const hand = diamondHand(drawn);
    const mult = DIAMOND_PAY[hand];
    const pay = payout(stake, mult);
    if (pay) credit(pay);
    record("Diamonds", stake, pay);
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setGems(drawn.slice(0, i).concat(Array(5 - i).fill(-1)));
      if (i >= 5) {
        window.clearInterval(timer);
        setLabel(`${DIAMOND_LABEL[hand]} · ${mult.toFixed(2)}×`);
        setWin(mult > 0);
        setBusy(false);
      }
    }, 90);
  };

  return (
    <GameLayout
      title="Diamonds"
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
          <p className="hint">Profit shows five of a kind, the rarest hand.</p>
        </BetPanel>
      }
    >
      <div className="center-stage">
        <div className="gems">
          {gems.map((gem, index) => (
            <span key={`${index}-${gem}`} className={gem < 0 ? "gem" : "gem in"} style={{ background: gem < 0 ? "#213743" : COLORS[gem] }} />
          ))}
        </div>
        <p className={win == null ? "result-line" : win ? "result-line win" : "result-line lose"}>{label}</p>
      </div>
    </GameLayout>
  );
}
