import { useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { EDGE } from "../lib/math";
import { luckOn } from "../lib/luck";
import { betCents, formatMult, formatUSD, payout } from "../lib/money";
import { random } from "../lib/random";
import { sound } from "../lib/sound";
import { useWallet } from "../state/wallet";

const TILES = 12;

const DIFFS = {
  easy: { label: "Easy", grow: 1.16 },
  medium: { label: "Medium", grow: 1.4 },
  hard: { label: "Hard", grow: 1.78 },
  extreme: { label: "Extreme", grow: 2.24 },
} as const;

type Diff = keyof typeof DIFFS;

export function Stripmine() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [diff, setDiff] = useState<Diff>("medium");
  const [step, setStep] = useState(0);
  const [stake, setStake] = useState(0);
  const [active, setActive] = useState(false);
  const [dead, setDead] = useState(false);
  const [cashed, setCashed] = useState(false);
  const [swing, setSwing] = useState(0);
  const [error, setError] = useState("");

  const grow = DIFFS[diff].grow;
  const survive = (1 - EDGE) / grow;
  const mult = grow ** step;

  const finish = (pay: number) => {
    if (pay) credit(pay);
    record("Stripmine", stake, pay);
    setActive(false);
  };

  const start = () => {
    const bet = betCents(amount, balance);
    if (bet == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(bet)) return;
    setError("");
    setStake(bet);
    setStep(0);
    setDead(false);
    setCashed(false);
    setActive(true);
    setSwing((value) => value + 1);
  };

  const dig = () => {
    if (!active) return;
    const next = step + 1;
    setSwing((value) => value + 1);
    if (!luckOn() && random() > survive) {
      setStep(next);
      setDead(true);
      sound.bomb();
      finish(0);
      return;
    }
    sound.gem();
    setStep(next);
    if (next >= TILES) {
      const pay = payout(stake, grow ** next);
      sound.cash();
      setCashed(true);
      finish(pay);
    }
  };

  const cashout = () => {
    if (!active || step < 1) return;
    const pay = payout(stake, mult);
    sound.cash();
    setCashed(true);
    finish(pay);
  };

  return (
    <GameLayout
      title="Stripmine"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={step > 0 && active ? Math.max(0, payout(stake, mult) - stake) : 0}
          label={active ? `Cash out ${formatUSD(payout(stake, Math.max(mult, 1)))}` : "Bet"}
          onAction={active ? cashout : start}
          disabled={active && step < 1}
          cashout={active && step > 0}
          locked={active}
          error={error}
        >
          <div className="field">
            <span className="field-label">Difficulty</span>
            <div className="select">
              {(Object.keys(DIFFS) as Diff[]).map((id) => (
                <button key={id} type="button" className={diff === id ? "on" : ""} disabled={active} onClick={() => setDiff(id)}>
                  {DIFFS[id].label}
                </button>
              ))}
            </div>
          </div>
          {active ? (
            <button className="ghost-btn" type="button" onClick={dig}>
              Dig
            </button>
          ) : (
            <p className="hint">Dig one tile at a time. Cash out before lava. Each safe tile raises the multiplier.</p>
          )}
        </BetPanel>
      }
    >
      <div className="strip-stage">
        <p className="strip-mult">{formatMult(active || cashed || dead ? Math.max(mult, dead ? 0 : 1) : grow)}</p>
        <div className="strip-tunnel" aria-label="Strip mine tunnel">
          <span className="strip-miner" data-swing={swing % 2} style={{ transform: `translateX(${Math.min(step, TILES - 1) * 100}%)` }} aria-hidden="true" />
          {Array.from({ length: TILES }, (_, index) => {
            const opened = index < step;
            const lava = dead && index === step - 1;
            return <span key={index} className={lava ? "lava" : opened ? "ore" : "rock"} data-here={!dead && !cashed && index === step} />;
          })}
        </div>
        <p role="status">
          {dead ? "Lava. The run is over." : cashed ? `Cashed out at ${formatMult(mult)}.` : active ? `${step} safe ${step === 1 ? "tile" : "tiles"}. Next tile pays ${formatMult(grow ** (step + 1))}.` : "Place a bet, then dig the tunnel."}
        </p>
      </div>
    </GameLayout>
  );
}
