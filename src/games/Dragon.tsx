import { useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { towerMultiplier } from "../lib/math";
import { betCents, formatMult, formatUSD, payout } from "../lib/money";
import { shuffle } from "../lib/random";
import { sound } from "../lib/sound";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";

const LEVELS = {
  Easy: { tiles: 4, dragons: 1 },
  Medium: { tiles: 3, dragons: 1 },
  Hard: { tiles: 2, dragons: 1 },
  Expert: { tiles: 3, dragons: 2 },
} as const;

type Level = keyof typeof LEVELS;
const ROWS = 9;

export function Dragon() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [level, setLevel] = useState<Level>("Easy");
  const [tiles, setTiles] = useState<number>(LEVELS.Easy.tiles);
  const [dragons, setDragons] = useState<number[][] | null>(null);
  const [row, setRow] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const [bust, setBust] = useState(false);
  const [cashed, setCashed] = useState(false);
  const [stake, setStake] = useState(0);
  const [error, setError] = useState("");

  const config = LEVELS[level];
  const ended = bust || cashed || row >= ROWS;
  const active = dragons != null && !ended;
  const cleared = bust ? Math.max(0, picks.length - 1) : picks.length;
  const live = towerMultiplier(Math.max(cleared, 0), config.tiles, config.dragons);
  const next = towerMultiplier(cleared + 1, config.tiles, config.dragons);
  const cents = Math.round(amount * 100);

  const start = () => {
    const bet = betCents(amount, balance);
    if (bet == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(bet)) return;
    setError("");
    setStake(bet);
    setTiles(config.tiles);
    setRow(0);
    setPicks([]);
    setBust(false);
    setCashed(false);
    setDragons(
      Array.from({ length: ROWS }, () => shuffle([...Array(config.tiles).keys()]).slice(0, config.dragons)),
    );
  };

  const cashout = () => {
    if (!active || picks.length === 0) return;
    const pay = payout(stake, towerMultiplier(picks.length, config.tiles, config.dragons));
    if (pay) credit(pay);
    record("Dragon Tower", stake, pay);
    setCashed(true);
  };

  const choose = (tile: number) => {
    if (!active || !dragons) return;
    let rowDragons = dragons[row]!;
    if (luckOn() && rowDragons.includes(tile)) {
      const swap = [...Array(tiles).keys()].find((index) => index !== tile && !rowDragons.includes(index));
      if (swap != null) {
        rowDragons = rowDragons.map((dragon) => (dragon === tile ? swap : dragon));
        setDragons(dragons.map((entry, index) => (index === row ? rowDragons : entry)));
      }
    }
    const bad = rowDragons.includes(tile);
    const nextPicks = [...picks, tile];
    setPicks(nextPicks);
    if (bad) {
      sound.bomb();
      setBust(true);
      record("Dragon Tower", stake, 0);
      return;
    }
    sound.gem();
    if (row + 1 === ROWS) {
      const pay = payout(stake, towerMultiplier(ROWS, config.tiles, config.dragons));
      if (pay) credit(pay);
      record("Dragon Tower", stake, pay);
      setRow(ROWS);
      return;
    }
    setRow(row + 1);
  };

  const profit =
    active && picks.length
      ? Math.max(0, payout(stake, live) - stake)
      : Math.max(0, payout(Math.max(cents, 0), towerMultiplier(1, config.tiles, config.dragons)) - Math.max(cents, 0));

  return (
    <GameLayout
      title="Dragon Tower"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={profit}
          label={active && picks.length ? `Cash out ${formatUSD(payout(stake, live))}` : "Bet"}
          onAction={active ? cashout : start}
          disabled={Boolean(active && picks.length === 0)}
          cashout={Boolean(active && picks.length)}
          locked={active}
          error={error}
        >
          <div className="field">
            <span className="field-label">Difficulty</span>
            <div className="select wrap">
              {(Object.keys(LEVELS) as Level[]).map((item) => (
                <button key={item} type="button" className={level === item ? "on" : ""} disabled={active} onClick={() => setLevel(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        </BetPanel>
      }
    >
      <div className="tower">
        <div className="mines-mult">
          <span>Next</span>
          <strong key={picks.length} className="mult-pop">
            {formatMult(next)}
          </strong>
        </div>
        {Array.from({ length: ROWS }, (_, index) => {
          const r = ROWS - 1 - index;
          const current = r === row && active;
          return (
            <div key={r} className={current ? "tower-row active" : "tower-row"}>
              {Array.from({ length: dragons ? tiles : config.tiles }, (_, tile) => {
                const picked = picks[r] === tile;
                const isDragon = Boolean(dragons?.[r]?.includes(tile));
                const showDragon = ended && isDragon;
                const showSafe = picked && !isDragon;
                const cls = showDragon ? "tile-btn dragon" : showSafe ? "tile-btn safe" : "tile-btn";
                return (
                  <button key={tile} type="button" className={cls} disabled={!current} onClick={() => choose(tile)}>
                    {showDragon ? "💣" : showSafe ? <img className="blockbet-revealed-gem" src="/images/gem-green.webp" alt="Safe gem" draggable={false}/> : ""}
                  </button>
                );
              })}
            </div>
          );
        })}
        {ended && dragons ? <p className="hint">{bust ? "Bombs revealed." : "Round over. Bombs are marked."}</p> : null}
      </div>
    </GameLayout>
  );
}
