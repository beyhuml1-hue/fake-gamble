import { useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { EDGE } from "../lib/math";
import { betCents, formatMult, formatUSD, payout } from "../lib/money";
import { random } from "../lib/random";
import { sound } from "../lib/sound";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";

const GROWTH = 1.24;
const SURVIVE = (1 - EDGE) / GROWTH;

export function Pump() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [mult, setMult] = useState(1);
  const [pumps, setPumps] = useState(0);
  const [stake, setStake] = useState(0);
  const [active, setActive] = useState(false);
  const [popped, setPopped] = useState(false);
  const [bump, setBump] = useState(0);
  const [error, setError] = useState("");

  const start = () => {
    const bet = betCents(amount, balance);
    if (bet == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(bet)) return;
    setError("");
    setStake(bet);
    setMult(1);
    setPumps(0);
    setPopped(false);
    setActive(true);
  };

  const pump = () => {
    if (!active) return;
    if (!luckOn() && random() > SURVIVE) {
      setPopped(true);
      setActive(false);
      sound.bomb();
      record("Pump", stake, 0);
      return;
    }
    sound.pump();
    setBump((n) => n + 1);
    setPumps((n) => n + 1);
    setMult((current) => current * GROWTH);
  };

  const cashout = () => {
    if (!active || mult <= 1) return;
    const pay = payout(stake, mult);
    if (pay) credit(pay);
    record("Pump", stake, pay);
    sound.cash();
    setActive(false);
  };

  const cents = Math.round(amount * 100);
  const shown = active ? mult : popped ? 0 : GROWTH;
  const profit = Math.max(0, payout(active ? stake : Math.max(cents, 0), Math.max(shown, 1)) - (active ? stake : Math.max(cents, 0)));
  const scale = Math.min(1.72, 0.78 + (mult - 1) * 0.7);
  const next = mult * GROWTH;

  return (
    <GameLayout
      title="Pump"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={profit}
          label={active ? `Cash out ${formatUSD(payout(stake, mult))}` : "Bet"}
          onAction={active ? cashout : start}
          disabled={active && mult <= 1}
          cashout={active && mult > 1}
          locked={active}
          error={error}
        >
          {active ? (
            <button className="ghost-btn" type="button" onClick={pump}>
              Pump
            </button>
          ) : (
            <p className="hint">Pump the balloon. Each pump pays more, and it can pop.</p>
          )}
        </BetPanel>
      }
    >
      <div className="center-stage pump-stage">
        <div className="pump-read">
          <div className="stat">
            <span>Pumps</span>
            <strong>{pumps}</strong>
          </div>
          <div className="stat">
            <span>Now</span>
            <strong>{formatMult(active ? mult : popped ? 0 : 1)}</strong>
          </div>
          <div className="stat">
            <span>Next</span>
            <strong>{formatMult(active ? next : GROWTH)}</strong>
          </div>
        </div>
        <div className="balloon-rig">
          {popped
            ? Array.from({ length: 6 }, (_, i) => <i key={i} className="shard" style={{ ["--i" as string]: i }} />)
            : null}
          <div className="balloon-wrap" style={{ transform: `scale(${popped ? 1 : scale})` }}>
            <div key={bump} className={popped ? "balloon popped" : bump ? "balloon pump-bump" : "balloon"}>
              <span className="balloon-shine" />
              {popped ? "✕" : formatMult(active ? mult : 1)}
              <i className="knot" />
            </div>
            <span className="string" />
          </div>
        </div>
        {active ? (
          <button className="pump-btn" type="button" onClick={pump}>
            Pump
          </button>
        ) : null}
        <p className={popped ? "result-line lose" : active && mult > 1 ? "result-line win" : "result-line"}>
          {popped ? "Popped" : active ? `${Math.round(SURVIVE * 100)}% chance the next pump holds` : "Place a bet, then pump"}
        </p>
      </div>
    </GameLayout>
  );
}
