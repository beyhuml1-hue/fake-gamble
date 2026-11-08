import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { PLINKO, PLINKO_ROWS, type PlinkoRows, type Risk } from "../lib/math";
import { betCents, formatMult, payout } from "../lib/money";
import { random } from "../lib/random";
import { useWallet } from "../state/wallet";

type Ball = { step: number; rights: number };

export function Plinko() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [risk, setRisk] = useState<Risk>("medium");
  const [rows, setRows] = useState<PlinkoRows>(12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [landed, setLanded] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballRef = useRef<Ball | null>(null);
  const landedRef = useRef<number | null>(null);
  const rafRef = useRef(0);

  const bins = PLINKO[risk][rows];

  const paint = () => {
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

    const top = 28;
    const bottom = h - 64;
    const gapY = (bottom - top) / rows;
    const gapX = Math.min(46, (w * 0.86) / rows);
    const ball = ballRef.current;

    for (let r = 0; r < rows; r++) {
      const count = r + 1;
      const y = top + gapY * (r + 1);
      for (let i = 0; i < count; i++) {
        const x = w / 2 + (i - (count - 1) / 2) * gapX;
        ctx.beginPath();
        ctx.fillStyle = "#b1bad3";
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    bins.forEach((mult, i) => {
      const x = w / 2 + (i - rows / 2) * gapX;
      const hot = landedRef.current === i;
      ctx.fillStyle = hot ? "#00e701" : mult >= 5 ? "#ffbf39" : mult >= 1 ? "#2f4553" : "#7f1d1d";
      const bw = Math.max(18, gapX - 4);
      ctx.beginPath();
      ctx.roundRect(x - bw / 2, h - 42, bw, 28, 4);
      ctx.fill();
      ctx.fillStyle = hot ? "#04140a" : "#ffffff";
      ctx.font = `700 ${bw < 26 ? 8 : 10}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(mult >= 100 ? String(Math.round(mult)) : mult.toFixed(mult >= 10 ? 0 : 1), x, h - 28);
    });

    if (ball) {
      const x = w / 2 + (ball.rights - ball.step / 2) * gapX;
      const y = top + gapY * ball.step + 8;
      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  useEffect(() => {
    landedRef.current = landed;
    paint();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
    // paint closes over the latest bins via render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, risk, landed, bins]);

  const drop = () => {
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    setBusy(true);
    setLanded(null);
    landedRef.current = null;
    const path: number[] = [];
    let rights = 0;
    for (let i = 0; i < rows; i++) {
      const right = random() < 0.5 ? 1 : 0;
      path.push(right);
      rights += right;
    }
    const bin = rights;
    const mult = bins[bin] ?? 0;
    const pay = payout(stake, mult);
    if (pay) credit(pay);
    record("Plinko", stake, pay);

    const start = performance.now();
    const run = (now: number) => {
      const t = Math.min(1, (now - start) / (rows * 140));
      const step = Math.min(rows, t * rows);
      const whole = Math.floor(step);
      let r = 0;
      for (let i = 0; i < whole; i++) r += path[i] ?? 0;
      const frac = step - whole;
      if (whole < rows) r += (path[whole] ?? 0) * frac;
      ballRef.current = { step, rights: r };
      paint();
      if (t < 1) rafRef.current = requestAnimationFrame(run);
      else {
        ballRef.current = { step: rows, rights: bin };
        landedRef.current = bin;
        setLanded(bin);
        setBusy(false);
      }
    };
    rafRef.current = requestAnimationFrame(run);
  };

  const cents = Math.round(amount * 100);
  const maxBin = Math.max(...bins);
  const profit = Math.max(0, payout(Math.max(cents, 0), maxBin) - Math.max(cents, 0));

  return (
    <GameLayout
      title="Plinko"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={profit}
          label="Bet"
          onAction={drop}
          disabled={busy}
          error={error}
        >
          <div className="field">
            <span className="field-label">Risk</span>
            <div className="select">
              {(["low", "medium", "high"] as Risk[]).map((item) => (
                <button key={item} type="button" className={risk === item ? "on" : ""} disabled={busy} onClick={() => setRisk(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">Rows</span>
            <div className="select">
              {PLINKO_ROWS.map((item) => (
                <button key={item} type="button" className={rows === item ? "on" : ""} disabled={busy} onClick={() => setRows(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <p className="hint">Profit shows the top bin, {formatMult(maxBin)}.</p>
        </BetPanel>
      }
    >
      <canvas ref={canvasRef} className="board-canvas" />
    </GameLayout>
  );
}
