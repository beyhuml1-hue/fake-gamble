import { useEffect, useState } from "react";
import { shuffle } from "../lib/random";
import { sound } from "../lib/sound";
import "./mines-battles.css";

const SIZE = 25;
const TILES = Array.from({ length: SIZE }, (_, i) => i);
type Turn = "you" | "rival";
type Battle = {
  mines: number[];
  revealed: number[];
  turn: Turn;
  outcome: "playing" | "won" | "lost" | "draw";
  last: number | null;
  lastBy: Turn | null;
  yourScore: number;
  rivalScore: number;
};

function fresh(mines: number): Battle {
  return {
    mines: shuffle([...TILES]).slice(0, mines),
    revealed: [],
    turn: "you",
    outcome: "playing",
    last: null,
    lastBy: null,
    yourScore: 0,
    rivalScore: 0,
  };
}

function openTile(game: Battle, tile: number, by: Turn): Battle {
  if (game.outcome !== "playing" || game.turn !== by || game.revealed.includes(tile)) return game;
  const revealed = [...game.revealed, tile];
  const hit = game.mines.includes(tile);
  const safeCount = SIZE - game.mines.length;
  const score = hit ? 0 : 1;
  return {
    ...game,
    revealed,
    last: tile,
    lastBy: by,
    yourScore: game.yourScore + (by === "you" ? score : 0),
    rivalScore: game.rivalScore + (by === "rival" ? score : 0),
    outcome: hit ? (by === "you" ? "lost" : "won") : revealed.length >= safeCount ? "draw" : "playing",
    turn: by === "you" ? "rival" : "you",
  };
}

export function MinesBattles() {
  const [mineCount, setMineCount] = useState(3);
  const [game, setGame] = useState<Battle | null>(null);
  const [round, setRound] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const start = () => {
    setGame(fresh(mineCount));
    setLog(["Battle started. You reveal the first tile."]);
    setRound(v => v + 1);
  };

  const reveal = (tile: number) => {
    if (!game || game.turn !== "you" || game.outcome !== "playing" || game.revealed.includes(tile)) return;
    const next = openTile(game, tile, "you");
    setGame(next);
    if (next.outcome === "lost") {
      sound.bomb();
      setLog(lines => ["You hit a mine. Rival wins.", ...lines].slice(0, 6));
    } else {
      sound.gem();
      setLog(lines => ["You found a gem on tile " + (tile + 1) + ".", ...lines].slice(0, 6));
    }
  };

  useEffect(() => {
    if (!game || game.outcome !== "playing" || game.turn !== "rival") return;
    const timer = window.setTimeout(() => {
      setGame(current => {
        if (!current || current.outcome !== "playing" || current.turn !== "rival") return current;
        const available = TILES.filter(tile => !current.revealed.includes(tile));
        if (!available.length) return { ...current, outcome: "draw" };
        const random = new Uint32Array(1);
        crypto.getRandomValues(random);
        const picked = available[random[0]! % available.length]!;
        const next = openTile(current, picked, "rival");
        setLog(lines => [next.outcome === "won" ? "Rival hit a mine. You win!" : "Rival opened tile " + (picked + 1) + ".", ...lines].slice(0, 6));
        if (next.outcome === "won") sound.win();
        else sound.gem();
        return next;
      });
    }, 950);
    return () => window.clearTimeout(timer);
  }, [game, round]);

  const finished = game !== null && game.outcome !== "playing";
  const label = !game ? "Ready to battle" :
    game.outcome === "won" ? "You won the battle!" :
    game.outcome === "lost" ? "Rival wins this round" :
    game.outcome === "draw" ? "Draw — all gems found" :
    game.turn === "you" ? "Your turn — choose a tile" : "Rival is choosing…";

  return (
    <section className="mb-page">
      <div className="mb-heading">
        <div><small>BLOCKBET ORIGINALS / VERSUS</small><h1>Mines Battles</h1><p>One shared minefield. Take turns opening tiles. Hit a mine and lose.</p></div>
        <span className="mb-mode">PRACTICE · VS COMPUTER</span>
      </div>
      <div className="mb-layout">
        <aside className="mb-controls">
          <div className="mb-controls-head"><h2>Battle setup</h2><span>1v1</span></div>
          <label className="field"><span className="field-label">Mines <b>{mineCount}</b></span>
            <input className="range" type="range" min={1} max={12} disabled={Boolean(game && !finished)} value={mineCount}
              onChange={event => setMineCount(Number(event.target.value))} />
          </label>
          <p className="mb-rule">Each player uses the same 25 tiles. Opened tiles stay open for both players. Turns alternate after every safe pick.</p>
          <button className="bet-btn mb-start" type="button" disabled={Boolean(game && !finished)} onClick={start}>
            {!game ? "Start battle" : "Play again"}
          </button>
          <div className="mb-log"><h3>Battle activity</h3>
            {log.length ? log.map((entry, i) => <p key={round + "-" + i}>{entry}</p>) : <p>Start a battle to see every move.</p>}
          </div>
          <p className="mb-rule">Practice uses no Play USD. The computer picks randomly from unopened tiles and never sees hidden mines.</p>
        </aside>
        <main className="mb-arena">
          <div className="mb-scoreboard">
            <div className={"mb-player " + (game?.turn === "you" && !finished ? "on" : "")}>
              <span className="mb-avatar">Y</span><span><strong>You</strong><small>{game?.yourScore ?? 0} gems</small></span>
            </div>
            <b className="mb-vs">VS</b>
            <div className={"mb-player mb-opponent " + (game?.turn === "rival" && !finished ? "on" : "")}>
              <span><strong>Computer</strong><small>{game?.rivalScore ?? 0} gems</small></span><span className="mb-avatar">C</span>
            </div>
          </div>
          <div className={"mb-status " + (game?.outcome ?? "")} role="status">{label}</div>
          <div className="mb-board" aria-label="Shared Mines Battles board">
            {TILES.map(tile => {
              const revealed = game?.revealed.includes(tile) ?? false;
              const isMine = game?.mines.includes(tile) ?? false;
              const exposed = revealed || (finished && isMine);
              const last = tile === game?.last;
              return <button type="button" key={tile}
                className={"mb-tile" + (exposed ? (isMine ? " bomb" : " safe") : "") + (last ? " recent" : "")}
                disabled={!game || finished || game.turn !== "you" || revealed}
                aria-label={"Tile " + (tile + 1) + (exposed ? (isMine ? ", mine" : ", gem") : ", hidden")}
                onClick={() => reveal(tile)}>
                {exposed ? (isMine ? <span aria-hidden="true" className="mb-bomb">●</span> :
                  <img src="/images/gem-green.webp" alt="" draggable={false} />) : <span className="mb-tile-shine" />}
              </button>;
            })}
          </div>
          <div className="mb-bottom"><span>{game ? game.revealed.length : 0} / 25 tiles revealed</span><span>{mineCount} hidden mines</span></div>
          {finished && <button type="button" className="ghost-btn mb-rematch" onClick={start}>Rematch</button>}
        </main>
      </div>
    </section>
  );
}
