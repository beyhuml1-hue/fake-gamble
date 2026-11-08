import { useMemo, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { CASES, caseImage, type CaseDrop, type LootCase } from "../data/cases";
import { betCents, formatUSD } from "../lib/money";
import { random } from "../lib/random";
import { luckOn } from "../lib/luck";
import { sound } from "../lib/sound";
import { useWallet } from "../state/wallet";

const CARD = 132;
const LAND = 36;
const SPIN_MS = 3400;

function pickDrop(drops: CaseDrop[]) {
  if (luckOn()) return drops.reduce((best, drop) => (drop.item.worth > best.item.worth ? drop : best));
  const total = drops.reduce((sum, drop) => sum + drop.weight, 0);
  let roll = random() * total;
  for (const drop of drops) {
    roll -= drop.weight;
    if (roll <= 0) return drop;
  }
  return drops[0]!;
}

function fill(drops: CaseDrop[], count: number) {
  return Array.from({ length: count }, () => drops[Math.floor(random() * drops.length)]!);
}

export function Cases() {
  const { balance, debit, credit, record } = useWallet();
  const [query, setQuery] = useState("");
  const [band, setBand] = useState<"all" | "low" | "mid" | "high">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const box = CASES.find((item) => item.id === selectedId) ?? null;
  const [strip, setStrip] = useState<CaseDrop[]>([]);
  const [shift, setShift] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<CaseDrop | null>(null);
  const [error, setError] = useState("");
  const frame = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const ticks = useRef(0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CASES.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (band === "low") return item.price < 5;
      if (band === "mid") return item.price >= 5 && item.price < 15;
      if (band === "high") return item.price >= 15;
      return true;
    });
  }, [query, band]);

  const choose = (item: LootCase) => {
    if (spinning) return;
    setSelectedId(item.id);
    setResult(null);
    setShift(0);
    setStrip(fill(item.drops, 12));
    setError("");
  };

  const open = () => {
    if (!box || spinning) return;
    const stake = betCents(box.price, balance);
    if (stake == null) {
      setError("That case costs more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    const won = pickDrop(box.drops);
    const next = fill(box.drops, 48);
    next[LAND] = won;
    setStrip(next);
    setResult(null);
    setShift(0);
    setSpinning(false);
    window.clearTimeout(timer.current);
    window.cancelAnimationFrame(ticks.current);
    window.setTimeout(() => {
      const width = frame.current?.clientWidth ?? 640;
      const target = LAND * CARD - (width - 124) / 2;
      setSpinning(true);
      setShift(target);
      const started = performance.now();
      let last = -1;
      const watch = (now: number) => {
        const t = Math.min(1, (now - started) / SPIN_MS);
        const eased = 1 - (1 - t) ** 3.4;
        const index = Math.round((target * eased + (width - 124) / 2) / CARD);
        if (index !== last) {
          last = index;
          sound.tick();
        }
        if (t < 1) ticks.current = requestAnimationFrame(watch);
      };
      ticks.current = requestAnimationFrame(watch);
    }, 40);
    timer.current = window.setTimeout(() => {
      window.cancelAnimationFrame(ticks.current);
      const pay = Math.round(won.item.worth * 100);
      if (pay) credit(pay);
      record("Cases", stake, pay);
      setResult(won);
      setSpinning(false);
    }, SPIN_MS + 80);
  };

  const best = box ? Math.max(...box.drops.map((drop) => drop.item.worth)) : 0;
  const profit = box ? Math.max(0, Math.round(best * 100) - Math.round(box.price * 100)) : 0;

  return (
    <GameLayout
      title="Cases"
      note={`${CASES.length} cases`}
      panel={
        <BetPanel
          amount={box?.price ?? 0}
          onAmount={() => undefined}
          profitCents={profit}
          label={spinning ? "Opening…" : box ? `Open ${formatUSD(Math.round(box.price * 100))}` : "Pick a case"}
          onAction={open}
          disabled={!box || spinning}
          locked
          error={error}
        >
          {box ? (
            <button className="text-btn" type="button" disabled={spinning} onClick={() => setSelectedId(null)}>
              All cases
            </button>
          ) : (
            <p className="hint">Open a box. You get the item for what it is worth.</p>
          )}
        </BetPanel>
      }
    >
      {box ? (
        <div className="cases">
          <div className="case-hero">
            <img src={caseImage(box.id)} alt="" />
            <div>
              <strong>{box.name}</strong>
              <span>{formatUSD(Math.round(box.price * 100))} to open</span>
            </div>
          </div>
          <div className="case-window" ref={frame}>
            <div className={spinning ? "case-reel spin" : "case-reel"} style={{ transform: `translateX(${-shift}px)` }}>
              {strip.map((drop, index) => (
                <div key={`${drop.item.id}-${index}`} className={result && index === LAND ? "case-item hit" : "case-item"}>
                  <img src={caseImage(drop.item.id)} alt="" />
                  <strong>{formatUSD(Math.round(drop.item.worth * 100))}</strong>
                  <small>{drop.item.name}</small>
                </div>
              ))}
            </div>
            <span className="case-mark" />
          </div>
          <div className="drops">
            {box.drops.map((drop) => (
              <div key={drop.item.id} className="drop-card">
                <img src={caseImage(drop.item.id)} alt="" />
                <strong>{formatUSD(Math.round(drop.item.worth * 100))}</strong>
                <small>{drop.item.name}</small>
                <span>{drop.weight}%</span>
              </div>
            ))}
          </div>
          <p className={result == null ? "result-line" : result.item.worth > box.price ? "result-line win" : "result-line lose"}>
            {result == null ? "Open the case" : `${result.item.name} · ${formatUSD(Math.round(result.item.worth * 100))}`}
          </p>
        </div>
      ) : (
        <div className="case-browser">
          <div className="case-tools">
            <input
              value={query}
              placeholder="Search Apple, PS5, Nike"
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="select">
              {(
                [
                  ["all", "All"],
                  ["low", "Under $5"],
                  ["mid", "$5–$15"],
                  ["high", "$15+"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className={band === id ? "on" : ""} onClick={() => setBand(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="case-grid">
            {shown.map((item) => (
              <button key={item.id} type="button" className="case-card" onClick={() => choose(item)}>
                <img src={caseImage(item.id)} alt="" />
                <b>{item.name}</b>
                <span>{formatUSD(Math.round(item.price * 100))}</span>
              </button>
            ))}
          </div>
          {shown.length === 0 ? <p className="hint">No cases match that search.</p> : null}
        </div>
      )}
    </GameLayout>
  );
}
