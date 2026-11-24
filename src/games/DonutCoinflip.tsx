import { useEffect, useRef, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import type { ShellContext } from "../components/AppShell";
import { dsmp } from "../components/DonutCashier";
import { GameLayout } from "../components/GameLayout";
import { ReferenceGoldCoin } from "../components/ReferenceGoldCoin";
import { sound } from "../lib/sound";
import "../premium-games.css";

type Side = "heads" | "tails";
type Attempt = { id: string; amount: number; pick: Side };
type Round = { amount: number; outcome: Side; payout: number; balance: number };

export function DonutCoinflip() {
  const { donutCashier, openDonutCashier } = useOutletContext<ShellContext>();
  const [amount, setAmount] = useState("");
  const [pick, setPick] = useState<Side>("heads");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(false);
  const [degrees, setDegrees] = useState(0);
  const [round, setRound] = useState<Round>();
  const [error, setError] = useState("");
  const pending = useRef<Attempt | null>(null);
  const inFlight = useRef(false);
  const timer = useRef(0);
  const active = useRef(false);
  const { data, refresh } = donutCashier;
  const wallet = data?.wallet;

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; window.clearTimeout(timer.current); };
  }, []);

  async function play(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !wallet) return;
    const stake = Number(amount);
    if (!pending.current && (!data?.coinflip || !/^\d+$/.test(amount)
      || stake < 1_000 || stake > Math.min(wallet.balance, 100_000_000))) {
      setError("Enter a stake from 1,000 to 100M DSMP within your balance.");
      return;
    }
    const attempt = pending.current ?? { id: crypto.randomUUID(), amount: stake, pick };
    pending.current = attempt;
    inFlight.current = true;
    setBusy(true);
    setRetry(false);
    setRound(undefined);
    setError("");
    try {
      const response = await fetch("/api/auth/donut-coinflip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt),
      });
      const result = await response.json() as Round & { error?: string };
      if (response.status >= 500 && response.status !== 503) throw new Error("Uncertain round");
      if (!response.ok) {
        if (!active.current) return;
        pending.current = null;
        inFlight.current = false;
        setError(result.error || "The round could not start.");
        setBusy(false);
        return;
      }
      void refresh();
      if (!active.current) return;
      pending.current = null;
      sound.flip();
      setDegrees(previous => Math.ceil(previous / 360) * 360 + 2160 + (result.outcome === "tails" ? 180 : 0));
      timer.current = window.setTimeout(() => {
        setRound(result);
        inFlight.current = false;
        setBusy(false);
      }, 1700);
    } catch {
      if (!active.current) return;
      inFlight.current = false;
      setBusy(false);
      setRetry(true);
      setError("The outcome is pending. Retry this round to check it.");
    }
  }

  return <GameLayout title="Coinflip" note="DSMP · 1,000 minimum · Correct call pays 2×" panel={
    <form className="donut-coin-form" onSubmit={event => void play(event)}>
      <p>{wallet ? dsmp(wallet.balance) : "Link your Minecraft account to play."}</p>
      <label className="field">Stake in DSMP
        <input className="donut-stake" value={amount} inputMode="numeric" maxLength={9}
          disabled={busy || retry} onChange={event => setAmount(event.target.value)} />
      </label>
      <div className="select coin-side-picks" aria-label="Choose a side">
        {(["heads", "tails"] as const).map(side => <button key={side} type="button"
          className={pick === side ? "on" : ""} aria-pressed={pick === side} disabled={busy || retry}
          onClick={() => { setPick(side); setDegrees(Math.floor(degrees / 360) * 360 + (side === "tails" ? 180 : 0)); }}>
          {side === "heads" ? "Heads" : "Tails"}
        </button>)}
      </div>
      <button className="bet-btn" disabled={busy || !wallet || (!retry && (!data?.coinflip || !amount))}>
        {retry ? "Check round" : "Flip with DSMP"}
      </button>
      <button className="ghost-btn" type="button" onClick={openDonutCashier}>{wallet ? "DSMP wallet" : "Link account"}</button>
      {(!data?.coinflip && wallet) && <p role="status">DSMP Coinflip is paused.</p>}
      {error && <p role="status">{error}</p>}
    </form>
  }>
    <div className="center-stage">
      <div className="flip-coin-display">
        <ReferenceGoldCoin degrees={degrees} spinning={busy} />
        <div className="flip-feedback-slot" aria-live="polite">
          {busy ? "Flipping…" : round && `${round.outcome === "heads" ? "Heads" : "Tails"} · ${round.payout ? dsmp(round.payout) + " payout" : "No payout"}`}
        </div>
      </div>
    </div>
  </GameLayout>;
}
