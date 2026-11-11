import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { PLINKO, PLINKO_ROWS, type PlinkoRows, type Risk } from "../lib/math";
import { betCents, formatMult, payout } from "../lib/money";
import { random } from "../lib/random";
import { useWallet } from "../state/wallet";

const MAX_BALLS = 15;
const COLORS = [
  "#f8fafc",
  "#fde68a",
  "#86efac",
  "#93c5fd",
  "#f9a8d4",
  "#fdba74",
  "#c4b5fd",
  "#67e8f9",
  "#fca5a5",
  "#bef264",
  "#e9d5ff",
  "#fcd34d",
  "#a5b4fc",
  "#6ee7b7",
  "#fda4af",
];

type Ball = {
  id: number;
  path: number[];
  rows: number;
  stake: number;
  mult: number;
  bin: number;
  start: number;
  color: string;
  paid: boolean;
};

function pose(ball: Ball, now: number) {
  const dur = ball.rows * 150;
  const t = Math.min(1, (now - ball.start) / dur);
  const step = Math.min(ball.rows, t * ball.rows);
  const whole = Math.floor(step);
  let rights = 0;
  for (let i = 0; i < whole; i++) rights += ball.path[i] ?? 0;
  const frac = step - whole;
  const ease = frac * frac * (3 - 2 * frac);
  if (whole < ball.rows) rights += (ball.path[whole] ?? 0) * ease;
  // A small per-ball wobble and eased vertical hop simulate peg impacts.
  // Neither changes the sampled left/right path or its landing bin.
  const bounce=Math.sin(frac*Math.PI);
  const sway=bounce*Math.sin((whole+ball.id)*1.9)*.07;
  return {step,rights,sway,lift:t<1?Math.pow(bounce,.8):0,done:t>=1};
}

export function Plinko() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [risk, setRisk] = useState<Risk>("medium");
  const [rows, setRows] = useState<PlinkoRows>(12);
  const [flying, setFlying] = useState(0);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const balls = useRef<Ball[]>([]);
  const rowsRef = useRef(rows);
  const binsRef = useRef(PLINKO[risk][rows]);
  const creditRef = useRef(credit);
  const recordRef = useRef(record);
  const seq = useRef(0);
  rowsRef.current = rows;
  binsRef.current = PLINKO[risk][rows];
  creditRef.current = credit;
  recordRef.current = record;

  const bins = binsRef.current;
  const locked = flying > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let lastCount = 0;

    const paint = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.max(1, Math.floor(rect.width * dpr));
      const targetH = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const boardRows = rowsRef.current;
      const boardBins = binsRef.current;
      const top = 28;
      const bottom = h - 64;
      const gapY = (bottom - top) / boardRows;
      const gapX = Math.min(46, (w * 0.86) / boardRows);
      const hot = new Set(balls.current.filter((ball) => pose(ball, now).done).map((ball) => ball.bin));

      for (let r = 0; r < boardRows; r++) {
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

      boardBins.forEach((mult, i) => {
        const x = w / 2 + (i - boardRows / 2) * gapX;
        const on = hot.has(i);
        ctx.fillStyle = on ? "#00e701" : mult >= 5 ? "#ffbf39" : mult >= 1 ? "#2f4553" : "#7f1d1d";
        const bw = Math.max(18, gapX - 4);
        ctx.beginPath();
        ctx.roundRect(x - bw / 2, h - 42, bw, 28, 4);
        ctx.fill();
        ctx.fillStyle = on ? "#04140a" : "#ffffff";
        ctx.font = `700 ${bw < 26 ? 8 : 10}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(mult >= 100 ? String(Math.round(mult)) : mult.toFixed(mult >= 10 ? 0 : 1), x, h - 28);
      });

      for (const ball of balls.current) {
        const spot = pose(ball, now);
        const x = w / 2 + (spot.rights - spot.step / 2 + spot.sway) * gapX;
        const y = top + gapY * spot.step + 8 - spot.lift * gapY * 0.42;
        ctx.beginPath();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.ellipse(x, y + 14, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = ball.color;
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      let flyingNow = 0;
      const keep: Ball[] = [];
      for (const ball of balls.current) {
        const dur = ball.rows * 150;
        const done = now - ball.start >= dur;
        if (done && !ball.paid) {
          ball.paid = true;
          const pay = payout(ball.stake, ball.mult);
          if (pay) creditRef.current(pay);
          recordRef.current("Plinko", ball.stake, pay);
        }
        if (!done) flyingNow += 1;
        if (!done || now - ball.start < dur + 650) keep.push(ball);
      }
      balls.current = keep;
      if (flyingNow !== lastCount) {
        lastCount = flyingNow;
        setFlying(flyingNow);
      }
      paint(now);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    const observer = new ResizeObserver(() => paint(performance.now()));
    observer.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      for (const ball of balls.current) {
        if (!ball.paid) {
          ball.paid = true;
          const pay = payout(ball.stake, ball.mult);
          if (pay) creditRef.current(pay);
          recordRef.current("Plinko", ball.stake, pay);
        }
      }
      balls.current = [];
    };
  }, []);

  const drop = () => {
    if (balls.current.filter((ball) => performance.now() - ball.start < ball.rows * 150).length >= MAX_BALLS) return;
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    const boardRows = rowsRef.current;
    const table = binsRef.current;
    const path: number[] = [];
    let rights = 0;
    // Fair binomial paths: every decision is a 50/50 sample.
    for (let i = 0; i < boardRows; i++) {
      const right=random()<.5?1:0;
      path.push(right);
      rights += right;
    }
    seq.current += 1;
    balls.current.push({
      id: seq.current,
      path,
      rows: boardRows,
      stake,
      mult: table[rights] ?? 0,
      bin: rights,
      start: performance.now(),
      color: COLORS[(seq.current - 1) % COLORS.length]!,
      paid: false,
    });
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
          label={flying > 0 ? `Drop ${flying}/${MAX_BALLS}` : "Drop"}
          onAction={drop}
          disabled={flying >= MAX_BALLS}
          error={error}
        >
          <div className="field">
            <span className="field-label">Risk</span>
            <div className="select">
              {(["low", "medium", "high"] as Risk[]).map((item) => (
                <button key={item} type="button" className={risk === item ? "on" : ""} disabled={locked} onClick={() => setRisk(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">Rows</span>
            <div className="select">
              {PLINKO_ROWS.map((item) => (
                <button key={item} type="button" className={rows === item ? "on" : ""} disabled={locked} onClick={() => setRows(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <p className="hint">
            Up to {MAX_BALLS} balls at once. Each is its own bet. Top bin is {formatMult(maxBin)}.
          </p>
        </BetPanel>
      }
    >
      <canvas ref={canvasRef} className="board-canvas" />
    </GameLayout>
  );
}
