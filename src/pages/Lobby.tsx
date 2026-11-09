import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { ShellContext } from "../components/AppShell";
import { GAMES } from "../data/games";
import { formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";

const ART_KEY = "blockbet.cover-style.v2";
const ARCADE_COVERS = new Set(["plinko", "crash", "cases", "chicken", "darts", "blackjack"]);

function savedArtStyle() {
  try {
    return localStorage.getItem(ART_KEY) === "arcade" ? "arcade" : "classic";
  } catch {
    return "classic";
  }
}

const FEATURED = ["plinko", "crash", "cases", "chicken", "darts"];
const GROUPS = [
  { id: "all", label: "All games" },
  { id: "instant", label: "Instant" },
  { id: "table", label: "Tables" },
  { id: "climb", label: "Climb" },
] as const;
const GROUP_IDS: Record<string, string[] | null> = {
  all: null,
  instant: ["dice", "plinko", "crash", "limbo", "keno", "wheel", "flip", "diamonds", "darts"],
  table: ["blackjack", "roulette", "baccarat", "hilo"],
  climb: ["mines", "dragon", "pump", "cases", "upgrader", "chicken"],
};

export function Lobby() {
  const { query, setQuery } = useOutletContext<ShellContext>();
  const { history } = useWallet();
  const [artStyle, setArtStyle] = useState(savedArtStyle);
  const cover = (id: string) => artStyle === "arcade" && ARCADE_COVERS.has(id)
    ? `/covers/arcade/${id}.webp`
    : `/covers/cover-${id}.jpg`;

  function changeArtStyle(style: "classic" | "arcade") {
    setArtStyle(style);
    try { localStorage.setItem(ART_KEY, style); } catch { /* Storage unavailable. */ }
  }

  const [group, setGroup] = useState<(typeof GROUPS)[number]["id"]>("all");
  const q = query.trim().toLowerCase();
  const allowed = GROUP_IDS[group];
  const games = GAMES.filter((game) => {
    if (allowed && !allowed.includes(game.id)) return false;
    if (!q) return true;
    return game.name.toLowerCase().includes(q) || game.blurb.toLowerCase().includes(q);
  });
  const featured = q || group !== "all" ? [] : FEATURED.map((id) => games.find((game) => game.id === id)).filter((game) => game != null);
  const rest = q || group !== "all" ? games : games.filter((game) => !FEATURED.includes(game.id));
  const wagered = history.reduce((sum, row) => sum + row.wager, 0);
  const profit = history.reduce((sum, row) => sum + row.payout - row.wager, 0);

  return (
    <section className="lobby" data-cover-style={artStyle}>
      <div className="home-hero">
        <div>
          <p className="kicker">Play money</p>
          <h1>Casino lobby</h1>
          <p>Play with Play USD. No deposits or withdrawals.</p>
        </div>
        <Link to="/stats" className="hero-metrics" aria-label="View play stats">
          <span>
            <small>Net result</small>
            <b className={profit > 0 ? "pos" : profit < 0 ? "neg" : ""}>{formatUSD(profit)}</b>
          </span>
          <span>
            <small>Wagered</small>
            <b>{formatUSD(wagered)}</b>
          </span>
          <span>
            <small>Bets</small>
            <b>{history.length}</b>
          </span>
        </Link>
      </div>
      <Link to="/mines-battles" className="mines-battle-lobby">
        <span className="mines-battle-lobby-icon">◆</span>
        <span><small>LIVE MULTIPLAYER</small><strong>Mines Battles</strong><em>Challenge real players on separate 5×5 minefields</em></span>
        <b>Create or join ↗</b>
      </Link>
      <div className="lobby-tools">
        <label className="search lobby-search">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="5.5" />
            <path d="m15 15 4 4" />
          </svg>
          <input type="search" aria-label="Search games" placeholder="Search games" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="chip-row" role="group" aria-label="Game categories">
          {GROUPS.map((item) => (
            <button key={item.id} type="button" aria-pressed={group === item.id} onClick={() => setGroup(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="art-style">
          Cover style
          <select value={artStyle} onChange={event => changeArtStyle(event.target.value === "classic" ? "classic" : "arcade")}>
            <option value="arcade">Arcade</option>
            <option value="classic">Classic</option>
          </select>
        </label>
      </div>
      {games.length === 0 ? (
        <p className="empty-row">No games match that search.</p>
      ) : (
        <>
          {featured.length > 0 ? (
            <>
              <div className="section-label"><h2>Featured games</h2></div>
              <div className="feature-grid">
                {featured.map((game) => (
                  <Link key={game.id} to={`/game/${game.id}`} className="tile feature">
                    <span className="tile-art">
                      <img src={cover(game.id)} alt="" />
                      <span className="tile-name">
                        <b>{game.name}</b>
                        <small>{game.blurb}</small>
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
          <div className="section-label">
            <h2>{q ? "Search results" : featured.length ? "More games" : GROUPS.find((item) => item.id === group)?.label}</h2>
            <span>
              {rest.length} {rest.length === 1 ? "game" : "games"}
            </span>
          </div>
          <div className="tile-grid">
            {rest.map((game) => (
              <Link key={game.id} to={`/game/${game.id}`} className="tile">
                <span className="tile-art">
                  <img src={cover(game.id)} alt="" loading="lazy" />
                  <span className="tile-name">{game.name}</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
