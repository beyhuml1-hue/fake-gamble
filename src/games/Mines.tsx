import { useMemo, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents, formatMult, formatUSD, payout } from "../lib/money";
import { minesMultiplier } from "../lib/math";
import { shuffle } from "../lib/random";
import { useWallet } from "../state/wallet";

const TILES = 25;

export function Mines() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [mines, setMines] = useState(3);
  const [bombSet, setBombSet] = useState<number[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [bust, setBust] = useState(false);
  const [stake, setStake] = useState(0);
  const [error, setError] = useState("");

  const active = bombSet != null && !bust;
  const mult = minesMultiplier(Math.max(picked.length, active ? 0 : picked.length), mines);
  const nextMult = minesMultiplier(picked.length + 1, mines);
  const liveMult = picked.length === 0 ? minesMultiplier(1, mines) : minesMultiplier(picked.length, mines);
  const cents = Math.round(amount * 100);
  const profit = active
    ? Math.max(0, payout(stake, liveMult) - stake)
    : Math.max(0, payout(Math.max(cents, 0), minesMultiplier(1, mines)) - Math.max(cents, 0));

  const bombs = useMemo(() => new Set(bombSet ?? []), [bombSet]);

  const start = () => {
    const bet = betCents(amount, balance);
    if (bet == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(bet)) return;
    setError("");
    setStake(bet);
    setPicked([]);
    setBust(false);
    setBombSet(shuffle([...Array(TILES).keys()]).slice(0, mines));
  };

  const finish = (pay: number) => {
    if (pay) credit(pay);
    record("Mines", stake, pay);
    setBombSet(null);
  };

  const cashout = () => {
    if (!active || picked.length === 0) return;
    finish(payout(stake, minesMultiplier(picked.length, mines)));
  };

  const reveal = (index: number) => {
    if (!active || picked.includes(index)) return;
    if (bombs.has(index)) {
      setBust(true);
      setPicked((prev) => [...prev, index]);
      record("Mines", stake, 0);
      return;
    }
    const next = [...picked, index];
    setPicked(next);
    if (next.length === TILES - mines) finish(payout(stake, minesMultiplier(next.length, mines)));
  };

  return (
    <GameLayout
      title="Mines"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={picked.length === 0 && !bust ? profit : Math.max(0, payout(stake, liveMult) - stake)}
          label={active ? `Cash out ${picked.length ? formatUSD(payout(stake, liveMult)) : ""}` : "Bet"}
          onAction={active ? cashout : start}
          disabled={active && picked.length === 0}
          cashout={active && picked.length > 0}
          locked={active}
          error={error}
        >
          <label className="field">
            <span className="field-label">
              Mines <b>{mines}</b>
            </span>
            <input
              className="range"
              type="range"
              min={1}
              max={24}
              value={mines}
              disabled={bombSet != null}
              onChange={(event) => setMines(Number(event.target.value))}
            />
          </label>
        </BetPanel>
      }
    >
      <div className="mines-layout">
        <div className="mines-mult">
          <span>Next</span>
          <strong>{formatMult(active ? nextMult : minesMultiplier(1, mines))}</strong>
          <small>{mult && picked.length ? `Now ${formatMult(liveMult)}` : "Pick a gem"}</small>
        </div>
        <div className="mines-grid">
          {Array.from({ length: TILES }, (_, index) => {
            const open = picked.includes(index) || bust;
            const bomb = bombs.has(index);
            const cls = open ? (bomb ? "mine bomb" : "mine gem") : "mine";
            return (
              <button key={index} type="button" className={cls} disabled={!active || open} onClick={() => reveal(index)}>
                {open ? (bomb ? "✕" : "◆") : ""}
              </button>
            );
          })}
        </div>
        {bust ? (
          <button className="text-btn" type="button" onClick={() => { setBust(false); setPicked([]); setBombSet(null); }}>
            New round
          </button>
        ) : null}
      </div>
    </GameLayout>
  );
}
