import { useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { EDGE } from "../lib/math";
import { betCents, formatMult, formatUSD, payout } from "../lib/money";
import { random } from "../lib/random";
import { sound } from "../lib/sound";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";

const LANES = 10;

const DIFFS = {
  easy: { label: "Easy", grow: 1.18 },
  medium: { label: "Medium", grow: 1.44 },
  hard: { label: "Hard", grow: 1.86 },
} as const;

type Diff = keyof typeof DIFFS;

export function Chicken() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [diff, setDiff] = useState<Diff>("medium");
  const [step, setStep] = useState(0);
  const [stake, setStake] = useState(0);
  const [active, setActive] = useState(false);
  const [dead, setDead] = useState(false);
  const [cashed, setCashed] = useState(false);
  const [error, setError] = useState("");

  const grow = DIFFS[diff].grow;
  const survive = (1 - EDGE) / grow;
  const mult = grow ** step;

  const finish = (pay: number) => {
    if (pay) credit(pay);
    record("Chicken Road", stake, pay);
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
  };

  const cross = () => {
    if (!active) return;
    const next = step + 1;
    if (!luckOn() && random() > survive) {
      setStep(next);
      setDead(true);
      sound.bomb();
      finish(0);
      return;
    }
    sound.gem();
    setStep(next);
    if (next >= LANES) {
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

  const cents = Math.round(amount * 100);
  const preview = active ? mult : grow;
  const profit = Math.max(0, payout(active ? stake : Math.max(cents, 0), Math.max(preview, 1)) - (active ? stake : Math.max(cents, 0)));

  return (
    <GameLayout
      title="Chicken Road"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={step > 0 && active ? Math.max(0, payout(stake, mult) - stake) : profit}
          label={active ? `Cash out ${formatUSD(payout(stake, mult))}` : "Bet"}
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
            <button className="ghost-btn" type="button" onClick={cross}>
              Cross
            </button>
          ) : (
            <p className="hint">Cross one lane at a time. Cash out before a car reaches the chicken.</p>
          )}
        </BetPanel>
      }
    >
      <div className="road-wrap">
        <div className="road">
          <div className={`lane curb ${step === 0 ? "here" : ""}`}>
            {step === 0 ? <span className={dead ? "chick splat" : "chick"} /> : null}
            <small>Start</small>
          </div>
          {Array.from({ length: LANES }, (_, index) => {
            const lane = index + 1;
            const here = step === lane;
            return (
              <div key={lane} className={dead && here ? "lane boom" : lane < step || (here && !dead) ? "lane safe" : "lane"}>
                <span className="car a" style={{ animationDelay: `${(index % 4) * -0.35}s` }} />
                <span className="car b" style={{ animationDelay: `${-0.7 - (index % 3) * 0.2}s`, background: index % 2 ? "#f59e0b" : "#e11d48" }} />
                {here ? <span className={dead ? "chick splat" : "chick hop"} /> : null}
                <small>{formatMult(grow ** lane)}</small>
              </div>
            );
          })}
        </div>
        {active ? (
          <button className="pump-btn" type="button" onClick={cross}>
            Cross
          </button>
        ) : null}
        <p className={dead ? "result-line lose" : cashed ? "result-line win" : "result-line"}>
          {dead ? "Hit" : cashed ? `Cashed ${formatMult(mult)}` : active ? `${Math.round(survive * 100)}% to cross the next lane` : "Place a bet to start"}
        </p>
      </div>
    </GameLayout>
  );
}
