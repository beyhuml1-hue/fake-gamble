import { useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { KENO_PAY } from "../lib/math";
import { betCents, formatMult, payout } from "../lib/money";
import { shuffle } from "../lib/random";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";

export function Keno() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [picks, setPicks] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const table = KENO_PAY[picks.length] ?? [];
  const top = table.length ? Math.max(...table) : 0;
  const cents = Math.round(amount * 100);
  const profit = Math.max(0, payout(Math.max(cents, 0), top) - Math.max(cents, 0));
  const hits = picks.filter((n) => drawn.includes(n)).length;

  const toggle = (n: number) => {
    if (busy) return;
    setDrawn([]);
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter((item) => item !== n);
      if (prev.length >= 10) return prev;
      return [...prev, n];
    });
  };

  const play = () => {
    if (picks.length < 1) {
      setError("Pick at least one number.");
      return;
    }
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    setBusy(true);
    const pool = Array.from({ length: 40 }, (_, i) => i + 1);
    const draw = luckOn()
      ? shuffle([...picks, ...shuffle(pool.filter((n) => !picks.includes(n))).slice(0, Math.max(0, 10 - picks.length))]).slice(0, 10)
      : shuffle(pool).slice(0, 10);
    const hitCount = picks.filter((n) => draw.includes(n)).length;
    const mult = KENO_PAY[picks.length]?.[hitCount] ?? 0;
    const pay = payout(stake, mult);
    if (pay) credit(pay);
    record("Keno", stake, pay);
    setDrawn([]);
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setDrawn(draw.slice(0, i));
      if (i >= draw.length) {
        window.clearInterval(timer);
        setBusy(false);
      }
    }, 80);
  };

  return (
    <GameLayout
      title="Keno"
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
          <p className="hint">
            {picks.length} selected. Top pay {top ? formatMult(top) : "—"}.
            {drawn.length === 10 ? ` Hit ${hits}.` : ""}
          </p>
        </BetPanel>
      }
    >
      <div className="keno-grid">
        {Array.from({ length: 40 }, (_, index) => {
          const n = index + 1;
          const on = picks.includes(n);
          const hit = on && drawn.includes(n);
          const miss = !on && drawn.includes(n);
          return (
            <button
              key={n}
              type="button"
              className={hit ? "keno-cell hit" : miss ? "keno-cell miss" : on ? "keno-cell on" : "keno-cell"}
              onClick={() => toggle(n)}
            >
              {n}
            </button>
          );
        })}
      </div>
    </GameLayout>
  );
}
