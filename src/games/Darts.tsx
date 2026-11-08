import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents, formatMult, payout } from "../lib/money";
import { random } from "../lib/random";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";

const RINGS = [
  { name: "Bull", mult: 7, until: 0.1 },
  { name: "Inner", mult: 4, until: 0.28 },
  { name: "Middle", mult: 1.6, until: 0.55 },
  { name: "Outer", mult: 0.6, until: 0.82 },
  { name: "Edge", mult: 0.2, until: 1 },
] as const;

const FLIGHT = 720;

export function Darts() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [spot, setSpot] = useState({ x: 50, y: 8 });
  const [aim, setAim] = useState(90);
  const [zone, setZone] = useState<(typeof RINGS)[number] | null>(null);
  const [error, setError] = useState("");
  const timer = useRef(0);
  const pending = useRef<{ stake: number; pay: number; hit: (typeof RINGS)[number] } | null>(null);
  const creditRef = useRef(credit);
  const recordRef = useRef(record);
  creditRef.current = credit;
  recordRef.current = record;

  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current);
      const job = pending.current;
      if (!job) return;
      pending.current = null;
      if (job.pay) creditRef.current(job.pay);
      recordRef.current("Darts", job.stake, job.pay);
    };
  }, []);

  const throwDart = () => {
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    setBusy(true);
    setZone(null);
    const radius = Math.sqrt(random()) * (luckOn() ? 0.09 : 1);
    const angle = random() * Math.PI * 2;
    const hit = RINGS.find((ring) => radius <= ring.until) ?? RINGS[RINGS.length - 1]!;
    const pay = payout(stake, hit.mult);
    pending.current = { stake, pay, hit };
    setSpot({ x: 50, y: 8 });
    setAim(90);
    window.setTimeout(() => {
      setSpot({
        x: 50 + Math.cos(angle) * radius * 46,
        y: 50 + Math.sin(angle) * radius * 46,
      });
      setAim((angle * 180) / Math.PI);
    }, 30);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const job = pending.current;
      pending.current = null;
      if (!job) return;
      if (job.pay) credit(job.pay);
      record("Darts", job.stake, job.pay);
      setZone(job.hit);
      setBusy(false);
    }, FLIGHT);
  };

  const cents = Math.round(amount * 100);
  const profit = Math.max(0, payout(Math.max(cents, 0), RINGS[0].mult) - Math.max(cents, 0));

  return (
    <GameLayout
      title="Darts"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={profit}
          label="Throw"
          onAction={throwDart}
          disabled={busy}
          locked={busy}
          error={error}
        >
          <p className="hint">Closer to the middle pays more. The bull is {formatMult(RINGS[0].mult)}.</p>
        </BetPanel>
      }
    >
      <div className="center-stage">
        <div className="dart-board">
          <span className="ring edge" />
          <span className="ring outer" />
          <span className="ring middle" />
          <span className="ring inner" />
          <span className="ring bull" />
          <span
            className={busy || zone ? "dart fly" : "dart"}
            style={{ left: `${spot.x}%`, top: `${spot.y}%`, transform: `rotate(${aim}deg)` }}
          >
            <svg viewBox="0 0 48 16" width="44" height="16" aria-hidden="true">
              <path d="M6 8 L20 8" stroke="#d7dee7" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M18 8 L30 2.5 L30 13.5 Z" fill="#e11d48" />
              <path d="M26 8 L36 4 L36 12 Z" fill="#fb7185" />
              <path d="M2 8 L8 5.2 L8 10.8 Z" fill="#f8fafc" />
            </svg>
          </span>
        </div>
        <p className={zone == null ? "result-line" : zone.mult >= 1.6 ? "result-line win" : "result-line lose"}>
          {busy ? "In the air…" : zone == null ? "Throw at the board" : `${zone.name} · ${formatMult(zone.mult)}`}
        </p>
      </div>
    </GameLayout>
  );
}
