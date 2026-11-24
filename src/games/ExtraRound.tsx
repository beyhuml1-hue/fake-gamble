import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { gameById } from "../data/games";
import { betCents, formatMult, payout } from "../lib/money";
import { randInt } from "../lib/random";
import { useWallet } from "../state/wallet";

const reels = {
  farmyard: ["🌾", "🐄", "🐔", "🥕", "🍎"],
  beacon: ["💎", "🪙", "🟪", "🟩", "🧱"],
  vault: ["🐺", "🕷️", "🦇", "🐉", "👻"],
};
const digYield = 1.4;
const maxDepth = 8;
type Kind = "digger" | "poison" | keyof typeof reels;

export function ExtraRound({ kind }: { kind: Kind }) {
  const game = gameById(kind)!;
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [size, setSize] = useState(3);
  const [phase, setPhase] = useState<"ready" | "trap" | "picking" | "busy" | "done">("ready");
  const [message, setMessage] = useState<string>(game.blurb);
  const [depth, setDepth] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [trap, setTrap] = useState(-1);
  const [hit, setHit] = useState(-1);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const pending = useRef(0);
  const timer = useRef(0);
  const rivalTrap = useRef(-1);
  const actions = useRef({ credit, record });
  actions.current = { credit, record };

  useEffect(() => () => {
    window.clearTimeout(timer.current);
    if (pending.current) {
      actions.current.record(game.name, pending.current, 0);
      pending.current = 0;
    }
  }, [game.name]);

  function finish(mult: number, text: string) {
    const stake = pending.current;
    if (!stake) return;
    pending.current = 0;
    const returned = mult ? actions.current.credit(payout(stake, mult)) : 0;
    actions.current.record(game.name, stake, returned);
    setMessage(text);
    setPhase("done");
  }

  function start() {
    const stake = betCents(amount, balance);
    if (pending.current || stake === null || !debit(stake)) return;
    pending.current = stake;
    setRound(previous => previous + 1);
    setDepth(0);
    setTrap(-1);
    setHit(-1);
    setPicked([]);
    if (kind === "digger") {
      setPhase("picking");
      setMessage("Choose a block to dig.");
    } else if (kind === "poison") {
      rivalTrap.current = randInt(size ** 2);
      setPhase("trap");
      setMessage("Choose one tile to poison.");
    } else {
      const options = reels[kind];
      const result = Array.from({ length: 9 }, () => options[randInt(options.length)]);
      setSymbols(result);
      setPhase("busy");
      setMessage("Spinning…");
      const lines = [0, 3, 6].filter(i => result[i] === result[i + 1] && result[i] === result[i + 2]).length;
      timer.current = window.setTimeout(() => finish(lines * 8, lines ? `${lines} matching row${lines === 1 ? "" : "s"}` : "No matching rows"), 650);
    }
  }

  function dig(index: number) {
    if (!pending.current || phase !== "picking") return;
    if (randInt(5) < 2) {
      setHit(index);
      finish(0, "Your pickaxe broke.");
      return;
    }
    const next = depth + 1;
    setDepth(next);
    if (next === maxDepth) finish(digYield ** next, "You reached bedrock.");
    else setMessage(`Depth ${next} · ${formatMult(digYield ** next)} available`);
  }

  function pick(index: number) {
    if (!pending.current || picked.includes(index)) return;
    if (phase === "trap") {
      setTrap(index);
      setPhase("picking");
      setMessage("Pick a tile. Avoid the rival’s trap.");
      return;
    }
    if (phase !== "picking" || index === trap) return;
    if (index === rivalTrap.current) {
      setHit(index);
      finish(0, "You found the rival’s trap.");
      return;
    }
    const remaining = Array.from({ length: size ** 2 }, (_, tile) => tile).filter(tile => tile !== index && tile !== rivalTrap.current && !picked.includes(tile));
    if (!remaining.length) {
      finish(1, "Draw. Your stake was returned.");
      return;
    }
    const rival = remaining[randInt(remaining.length)];
    setPicked([...picked, index, rival]);
    if (rival === trap) {
      setHit(rival);
      finish(1.9, "Your rival found your trap.");
    } else if (remaining.length === 1) finish(1, "Draw. Your stake was returned.");
    else setMessage("The rival picked a tile. Your turn.");
  }

  const busy = phase === "trap" || phase === "picking" || phase === "busy";
  const canCashOut = kind === "digger" && pending.current > 0 && depth > 0;
  return <GameLayout title={game.name} note={game.blurb} panel={
    <BetPanel amount={amount} onAmount={setAmount} profitCents={0} showProfit={false} label={kind in reels ? "Spin" : "Play"}
      disabled={busy} locked={busy} onAction={start} afterAction={canCashOut &&
        <button type="button" className="bet-btn" onClick={() => finish(digYield ** depth, "You cashed out.")}>
          Cash out {formatMult(digYield ** depth)}
        </button>}>
      {kind === "poison" && <label className="field">Board size<select value={size} disabled={busy} onChange={e => {
        setSize(Number(e.target.value));
        setPicked([]);
        setTrap(-1);
        setHit(-1);
        setPhase("ready");
      }}>{[3, 4, 5].map(n => <option key={n} value={n}>{n} × {n}</option>)}</select></label>}
    </BetPanel>
  }>
    <div className="extra-round">
      <h2>{game.name}</h2>
      {kind === "digger" ? <div className="extra-board dig-board" key={`${round}-${depth}`}>
        {[0, 1, 2].map(index => <button className="tile-btn" type="button" key={index} disabled={phase !== "picking"}
          aria-label={`Dig block ${index + 1}`} onClick={() => dig(index)}>{hit === index ? "💥" : "▧"}</button>)}
      </div> : kind === "poison" ? <div className="extra-board" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {Array.from({ length: size ** 2 }, (_, index) => <button className="tile-btn" type="button" key={index}
          aria-label={`Tile ${index + 1}${index === trap ? ", your trap" : ""}`} disabled={!busy || picked.includes(index) || index === trap}
          onClick={() => pick(index)}>{index === hit ? "💥" : index === trap ? "⚗" : picked.includes(index) ? "✓" : "◆"}</button>)}
      </div> : <div className={"extra-board reel-board " + (phase === "busy" ? "reel-spinning" : "")} key={round}>
        {(symbols.length ? symbols : Array.from({ length: 9 }, (_, i) => reels[kind][i % 5])).map((symbol, index) => <b key={index}>{symbol}</b>)}
      </div>}
      <p role="status">{message}</p>
    </div>
  </GameLayout>;
}
