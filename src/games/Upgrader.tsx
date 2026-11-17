import { useEffect, useRef, useState } from "react";
import { CoinMark } from "../components/Icons";
import { betCents, formatCoins, payout } from "../lib/money";
import { random } from "../lib/random";
import { luckOn } from "../lib/luck";
import {
  MAX_STACK,
  UPGRADE_ITEMS,
  pickUpgradeTarget,
  upgradeChance,
  upgradeMultiplier,
  type UpgradeItem,
} from "../lib/upgrader";
import { useWallet } from "../state/wallet";

const SPIN_MS = 2600;
const PRESETS = [1.5, 2, 5, 10, 100];

function Glyph({ item }: { item: UpgradeItem }) {
  return <i className={"upg-glyph upg-" + item.kind} aria-hidden="true" />;
}

export function Upgrader() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [text, setText] = useState("1.00");
  const [index, setIndex] = useState(8);
  const [stack, setStack] = useState(1);
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [win, setWin] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const auto = useRef(false);
  const liveBalance = useRef(balance);
  liveBalance.current = balance;
  const spinTimer = useRef(0);
  const item = UPGRADE_ITEMS[index] ?? UPGRADE_ITEMS[0]!;
  const targetCoins = item.value * stack;
  const chance = upgradeChance(amount, targetCoins);
  const multiplier = upgradeMultiplier(amount, targetCoins);
  const stakeCents = Math.round(amount * 100);
  const targetCents = Math.round(targetCoins * 100);

  useEffect(() => () => {
    auto.current = false;
    window.clearTimeout(spinTimer.current);
  }, []);

  function writeAmount(next: number) {
    const safe = Math.max(0, Math.round(next * 100) / 100);
    setAmount(safe);
    setText(safe.toFixed(2));
  }

  function applyPreset(mult: number) {
    const pick = pickUpgradeTarget(Math.max(amount, 0.1), mult);
    setIndex(pick.index);
    setStack(pick.stack);
  }

  function spin() {
    const stake = betCents(amount, liveBalance.current);
    if (stake == null) {
      setError("Minimum bet is 0.10 coins, and it can't be more than your balance.");
      auto.current = false;
      return;
    }
    if (!(chance > 0) || targetCents <= stake) {
      setError("Pick a target worth more than your stake.");
      auto.current = false;
      return;
    }
    if (!debit(stake)) {
      auto.current = false;
      return;
    }
    setError("");
    setWin(null);
    const roll = luckOn() ? Math.min(chance * 0.25, 0.99) : random();
    const didWin = roll < chance;
    const pay = didWin ? payout(stake, targetCents / stake) : 0;
    const land = 360 * 5 + roll * 360;
    setSpinning(false);
    setAngle((current) => current % 360);
    window.setTimeout(() => {
      setSpinning(true);
      setAngle(land);
    }, 30);
    window.clearTimeout(spinTimer.current);
    spinTimer.current = window.setTimeout(() => {
      if (pay) credit(pay);
      record("Upgrader", stake, pay);
      setWin(didWin);
      setSpinning(false);
      if (auto.current) spinTimer.current = window.setTimeout(spin, 280);
    }, SPIN_MS + 40);
  }

  const arc = Math.max(0, Math.min(0.99, chance)) * 360;

  return (
    <section className="upg-page">
      <div className="upg-stage">
        <div className="upg-wheel" aria-hidden="true">
          <div className="upg-ring" style={{ background: `conic-gradient(from -90deg, #22c55e 0 ${arc}deg, #2c3034 ${arc}deg 360deg)` }} />
          <div className={spinning ? "upg-indicator spinning" : "upg-indicator"} style={{ transform: `rotate(${angle}deg)` }} />
          <div className="upg-hub" />
          <div className="upg-pointer" />
        </div>
        <p className={win == null ? "upg-result" : win ? "upg-result win" : "upg-result lose"} role="status">
          {spinning ? "Spinning…" : win == null ? "Land in the green arc." : win ? "Upgraded " + multiplier.toFixed(2) + "x" : "Miss"}
        </p>
        <div className="upg-compare">
          <div className="upg-slot">
            <span>Stake</span>
            <strong><CoinMark size={14} />{formatCoins(Math.max(0, stakeCents))}</strong>
          </div>
          <div className="upg-mid">
            <b>{(chance * 100).toFixed(2)}%</b>
            <span aria-hidden="true">→</span>
            <small>{multiplier.toFixed(2)}x</small>
            <em>{formatCoins(targetCents)} payout</em>
          </div>
          <div className="upg-slot">
            <span>Target</span>
            <strong><Glyph item={item} />{item.name}</strong>
          </div>
        </div>
        <div className="upg-inventory" role="listbox" aria-label="Upgrade items">
          {UPGRADE_ITEMS.map((entry, i) => (
            <button key={entry.id} type="button" role="option" aria-selected={i === index} disabled={spinning} className={i === index ? "on" : ""} onClick={() => setIndex(i)}>
              <Glyph item={entry} />
              <b>{entry.value < 100 ? entry.value.toFixed(entry.value < 10 ? 2 : 0) : entry.value.toLocaleString("en-US")}</b>
            </button>
          ))}
        </div>
      </div>
      <form className="upg-controls" onSubmit={(event) => { event.preventDefault(); if (auto.current) { auto.current = false; return; } if (mode === "auto") auto.current = true; spin(); }}>
        <div className="upg-mode" role="tablist">
          <button type="button" className={mode === "manual" ? "on" : ""} onClick={() => { auto.current = false; setMode("manual"); }}>Manual</button>
          <button type="button" className={mode === "auto" ? "on" : ""} onClick={() => setMode("auto")}>Auto</button>
        </div>
        <label className="field">
          <span className="field-label">Amount</span>
          <span className="amount">
            <CoinMark size={14} />
            <input inputMode="decimal" aria-label="Bet amount in coins" value={text} disabled={spinning} onChange={(event) => {
              const raw = event.target.value;
              if (!/^\d*\.?\d{0,2}$/.test(raw)) return;
              setText(raw);
              const parsed = Number(raw);
              if (Number.isFinite(parsed)) setAmount(parsed);
            }} onBlur={() => writeAmount(Number(text) || 0)} />
            <button className="step-btn" type="button" disabled={spinning} onClick={() => writeAmount(amount / 2)}>1/2</button>
            <button className="step-btn" type="button" disabled={spinning} onClick={() => writeAmount(Math.min(balance / 100, amount * 2))}>2x</button>
            <button className="step-btn step-max" type="button" disabled={spinning} onClick={() => writeAmount(balance / 100)}>Max</button>
          </span>
        </label>
        <div className="upg-presets" aria-label="Target multiplier">
          {PRESETS.map((preset) => (
            <button key={preset} type="button" disabled={spinning} onClick={() => applyPreset(preset)}>{preset}x</button>
          ))}
        </div>
        <div className="upg-stack">
          <span>Stack</span>
          <button type="button" disabled={spinning || stack <= 1} onClick={() => setStack((n) => Math.max(1, n - 1))}>−</button>
          <b>{stack}</b>
          <button type="button" disabled={spinning || stack >= MAX_STACK} onClick={() => setStack((n) => Math.min(MAX_STACK, n + 1))}>+</button>
          <button type="button" disabled={spinning} onClick={() => setStack(MAX_STACK)}>Max</button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="bet-btn upg-go" type="submit" disabled={spinning && !auto.current}>
          {auto.current ? "Stop" : mode === "auto" ? "Start Auto" : "Upgrade"}
        </button>
        <p className="upg-rule">Win chance is your stake divided by the target item, minus a 1% house edge. Coins have no cash value.</p>
      </form>
    </section>
  );
}
