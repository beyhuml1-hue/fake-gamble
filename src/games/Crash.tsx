import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { crashPoint } from "../lib/math";
import { betCents, formatMult, formatUSD, payout } from "../lib/money";
import { useWallet } from "../state/wallet";

type Phase = "idle" | "running" | "crashed" | "cashed";

export function Crash() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [mult, setMult] = useState(1);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const points = useRef<{ t: number; m: number }[]>([]);
  const raf = useRef(0);
  const crashAt = useRef(1);
  const started = useRef(0);
  const wager = useRef(0);
  const multRef = useRef(1);
  const settled = useRef(false);

  const paint = (color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#2f4553";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, h - 28);
    ctx.lineTo(w - 16, h - 28);
    ctx.stroke();
    const data = points.current;
    if (data.length < 2) return;
    const maxT = Math.max(4, data[data.length - 1]!.t);
    const maxM = Math.max(2, ...data.map((point) => point.m));
    ctx.beginPath();
    data.forEach((point, index) => {
      const x = 24 + ((w - 40) * point.t) / maxT;
      const y = h - 28 - ((h - 56) * (point.m - 1)) / (maxM - 1);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const settle = (pay: number, next: Phase) => {
    if (settled.current) return;
    settled.current = true;
    cancelAnimationFrame(raf.current);
    if (pay) credit(pay);
    record("Crash", wager.current, pay);
    setPhase(next);
    paint(next === "cashed" ? "#00e701" : "#e9113c");
  };

  const bet = () => {
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    wager.current = stake;
    crashAt.current = crashPoint();
    settled.current = false;
    multRef.current = 1;
    setMult(1);
    points.current = [{ t: 0, m: 1 }];
    started.current = performance.now();
    setPhase("running");

    const loop = (now: number) => {
      if (settled.current) return;
      const t = (now - started.current) / 1000;
      const grown = Math.max(1, Math.floor(Math.exp(t * 0.18) * 100) / 100);
      if (grown >= crashAt.current) {
        multRef.current = crashAt.current;
        setMult(crashAt.current);
        points.current.push({ t, m: crashAt.current });
        settle(0, "crashed");
        return;
      }
      multRef.current = grown;
      setMult(grown);
      points.current.push({ t, m: grown });
      paint("#00e701");
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  const cashout = () => {
    const m = multRef.current;
    if (m < 1.01) return;
    settle(payout(wager.current, m), "cashed");
  };

  const running = phase === "running";
  const cents = Math.round(amount * 100);
  const profit = running ? Math.max(0, payout(wager.current, mult) - wager.current) : Math.max(0, payout(Math.max(cents, 0), 2) - Math.max(cents, 0));

  return (
    <GameLayout
      title="Crash"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={profit}
          label={running ? `Cash out ${formatUSD(payout(wager.current, mult))}` : "Bet"}
          onAction={running ? cashout : bet}
          disabled={running && mult < 1.01}
          cashout={running}
          locked={running}
          error={error}
        >
          <p className="hint">Profit before launch assumes a 2.00× cash out.</p>
        </BetPanel>
      }
    >
      <div className="crash-stage">
        <div className={phase === "crashed" ? "readout lose" : phase === "cashed" ? "readout win" : "readout"}>
          {formatMult(mult)}
        </div>
        <canvas ref={canvasRef} className="board-canvas short" />
      </div>
    </GameLayout>
  );
}
