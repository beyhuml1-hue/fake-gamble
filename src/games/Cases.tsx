import { useEffect, useMemo, useRef, useState } from "react";
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

function weightedDrop(drops: CaseDrop[]) {
  const total = drops.reduce((sum, drop) => sum + drop.weight, 0);
  let roll = random() * total;
  for (const drop of drops) {
    roll -= drop.weight;
    if (roll < 0) return drop;
  }
  return drops[drops.length - 1]!;
}
function fill(drops: CaseDrop[], count: number) {
  // Visual reel uses the same item odds as the actual drop, not uniform odds.
  return Array.from({ length: count }, () => weightedDrop(drops));
}

export function Cases() {
  const { balance, debit, credit, record } = useWallet();
  const [query, setQuery] = useState("");
  const [quantity,setQuantity] = useState(1);
  const [quick,setQuick] = useState(false);
  const [maxPrice,setMaxPrice] = useState(1000000);
  const [risk,setRisk] = useState(100);
  const [batch,setBatch] = useState<CaseDrop[]>([]);
  const opening = useRef(false);
  const pending = useRef<{stake:number;pay:number;drops:CaseDrop[]}|null>(null);
  const wallet = useRef({credit,record});
  wallet.current={credit,record};
  const [sort,setSort] = useState<"default"|"low"|"high">("default");
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
    const matches = CASES.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (item.price>maxPrice) return false;
      const losingChance=item.drops.filter(drop=>drop.item.worth<item.price).reduce((sum,drop)=>sum+drop.weight,0);
      if (losingChance>risk) return false;
      if (band === "low") return item.price < 5;
      if (band === "mid") return item.price >= 5 && item.price < 15;
      if (band === "high") return item.price >= 15;
      return true;
    });
    if (sort==="low") return matches.sort((a,b)=>a.price-b.price);
    if (sort==="high") return matches.sort((a,b)=>b.price-a.price);
    return matches;
  }, [query, band, sort, maxPrice, risk]);

  const choose = (item: LootCase) => {
    if (spinning) return;
    setSelectedId(item.id);
    setResult(null);
    setShift(0);
    setStrip(fill(item.drops, 12));
    setError("");
  };

  const complete = () => {
    const due=pending.current;
    if (!due) return;
    pending.current=null;
    const paid=wallet.current.credit(due.pay);
    wallet.current.record("Cases",due.stake,paid);
    setBatch(due.drops);
    setResult(due.drops[0]!);
    opening.current=false;
    setSpinning(false);
  };
  useEffect(()=>()=> {
    window.clearTimeout(timer.current);
    window.cancelAnimationFrame(ticks.current);
    const due=pending.current;
    pending.current=null;
    if (due) wallet.current.record("Cases",due.stake,wallet.current.credit(due.pay));
  },[]);
  const open = () => {
    if (!box || opening.current) return;
    const stake = betCents(box.price*quantity, balance);
    if (stake == null) {setError("The selected cases cost more than your balance.");return;}
    if (!debit(stake)) return;
    opening.current=true;
    setError("");
    const won=Array.from({length:quantity},()=>pickDrop(box.drops));
    pending.current={stake,pay:won.reduce((sum,drop)=>sum+Math.round(drop.item.worth*100),0),drops:won};
    const next=fill(box.drops,48);
    next[LAND]=won[0]!;
    setStrip(next);
    setBatch([]);
    setResult(null);
    setShift(0);
    setSpinning(true);
    const duration=quick?550:SPIN_MS;
    timer.current=window.setTimeout(()=>{
      const width=frame.current?.clientWidth??640;
      const target=LAND*CARD-(width-124)/2;
      setShift(target);
      const began=performance.now();
      let last=-1;
      const watch=(now:number)=>{
        const t=Math.min(1,(now-began)/duration);
        const eased=1-(1-t)**3.4;
        const index=Math.round((target*eased+(width-124)/2)/CARD);
        if(index!==last){last=index;sound.tick();}
        if(t<1)ticks.current=requestAnimationFrame(watch);
      };
      ticks.current=requestAnimationFrame(watch);
      timer.current=window.setTimeout(complete,duration+40);
    },40);
  };

  const best = box ? Math.max(...box.drops.map((drop) => drop.item.worth)) : 0;
  const profit = box ? Math.max(0, Math.round(best * 100) - Math.round(box.price * 100)) : 0;

  return (
    <GameLayout
      title="Cases"
      note={`${CASES.length} cases`}
      panel={
        <BetPanel
          amount={(box?.price ?? 0)*quantity}
          onAmount={() => undefined}
          profitCents={profit}
          amountLabel="Selected case price"
          showProfit={Boolean(box)}
          label={spinning ? "Opening…" : box ? "Open " + quantity + " · " + formatUSD(Math.round(box.price * quantity * 100)) : "Pick a case"}
          onAction={open}
          disabled={!box || spinning}
          locked
          error={error}
        >
          {box && <div className="selected-case"><img src={caseImage(box.id)} alt=""/><b>{box.name}</b><span>{formatUSD(Math.round(box.price*100))}</span></div>}
          <div className="field"><span className="field-label">Quantity</span><div className="select case-quantity">{[1,2,3,4,5].map(n=>
            <button type="button" key={n} disabled={spinning} className={quantity===n?"on":""} onClick={()=>setQuantity(n)}>{n}</button>)}</div></div>
          <label className="case-quick"><span>Quick unbox</span><input type="checkbox" checked={quick} disabled={spinning} onChange={event=>setQuick(event.target.checked)}/></label>
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
          <div className={"case-window"+(quick?" case-window-quick":"")} ref={frame}>
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
          {batch.length>1 && <div className="case-batch" aria-label="All opened items">{batch.map((drop,i)=><article key={i}><img src={caseImage(drop.item.id)} alt=""/><b>{drop.item.name}</b><span>{formatUSD(Math.round(drop.item.worth*100))}</span></article>)}</div>}
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
          <div className="case-odds-label">Published item chances · {box.drops.reduce((sum, drop) => sum + drop.weight, 0)}% total</div>
          {result && (
            <div key={result.item.id} className={result.weight <= 5 ? "case-reveal rare" : "case-reveal"} role="status">
              <span className="case-reveal-shine" aria-hidden="true">✦</span>
              <b>{result.weight <= 5 ? "RARE DROP!" : "CASE OPENED"}</b>
              <strong>{result.item.name}</strong>
              <span>{formatUSD(Math.round(result.item.worth * 100))} · {((result.item.worth / box.price) || 0).toFixed(2)}× value</span>
            </div>
          )}
          <p className={result == null ? "result-line" : result.item.worth > box.price ? "result-line win" : "result-line lose"}>
            {result == null ? "Open the case" : `${result.item.name} · ${formatUSD(Math.round(result.item.worth * 100))}`}
          </p>
        </div>
      ) : (
        <div className="case-browser">
          <div className="case-tools">
            <input
              value={query}
              aria-label="Search cases"
              placeholder="Search cases"
              onChange={(event) => setQuery(event.target.value)}
            />
            <select aria-label="Sort cases" value={sort} onChange={event=>setSort(event.target.value as typeof sort)}>
              <option value="default">Featured</option><option value="low">Price: low first</option><option value="high">Price: high first</option>
            </select>
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
          <div className="case-filter-sliders">
            <label>Maximum losing-drop chance <b>{risk}%</b><input type="range" min={0} max={100} value={risk} onChange={event=>setRisk(Number(event.target.value))}/></label>
            <label>Maximum price <b>{formatUSD(Math.round(Math.min(maxPrice,Math.max(...CASES.map(item=>item.price)))*100))}</b><input type="range" min={0} max={Math.max(...CASES.map(item=>item.price))} step={0.01} value={Math.min(maxPrice,Math.max(...CASES.map(item=>item.price)))} onChange={event=>setMaxPrice(Number(event.target.value))}/></label>
          </div>
          <div className="case-grid">
            {shown.map((item) => (
              <button key={item.id} type="button" className="case-card" onClick={() => choose(item)}>
                <img src={caseImage(item.id)} alt="" />
                <b>{item.name}</b>
                <span>{formatUSD(Math.round(item.price * 100))}</span><small>{(Math.max(...item.drops.map(drop=>drop.item.worth))/item.price).toFixed(1)}× top</small>
              </button>
            ))}
          </div>
          {shown.length === 0 ? <p className="hint">No cases match that search.</p> : null}
        </div>
      )}
    </GameLayout>
  );
}
