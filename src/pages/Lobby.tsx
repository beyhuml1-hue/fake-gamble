import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { ShellContext } from "../components/AppShell";
import { GAMES } from "../data/games";
import { formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";

const FEATURED = ["plinko", "crash", "cases", "chicken", "darts"];
const GROUPS = [
  { id: "all", label: "For you" },
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
  const { query } = useOutletContext<ShellContext>();
  const { history } = useWallet();
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
    <section className="lobby">
      <div className="home-hero">
        <div>
          <p className="kicker">Originals</p>
          <h1>Blockbet</h1>
          <p>Instant games. Wins land on your balance the moment they settle.</p>
        </div>
        <Link to="/stats" className="hero-metrics">
          <span>
            <small>Net</small>
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
      <div className="reward-banner">
        <div>
          <p>Blockbet Rewards</p>
          <strong>Play the originals. Wins land on your balance.</strong>
          <Link to="/stats">View stats</Link>
        </div>
      </div>
      <div className="chip-row">
        {GROUPS.map((item) => (
          <button key={item.id} type="button" className={group === item.id ? "on" : ""} onClick={() => setGroup(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {games.length === 0 ? (
        <p className="empty-row">No games match that search.</p>
      ) : (
        <>
          {featured.length > 0 ? (
            <div className="feature-grid">
              {featured.map((game) => (
                <Link key={game.id} to={`/game/${game.id}`} className="tile feature">
                  <span className="tile-art">
                    <img src={`/covers/cover-${game.id}.jpg`} alt="" />
                    <span className="tile-name">
                      <b>{game.name}</b>
                      <small>{game.blurb}</small>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
          <div className="section-label">
            <h2>{group === "all" ? "All games" : GROUPS.find((item) => item.id === group)?.label}</h2>
            <span>
              {rest.length} {rest.length === 1 ? "game" : "games"}
            </span>
          </div>
          <div className="tile-grid">
            {rest.map((game, index) => (
              <Link key={game.id} to={`/game/${game.id}`} className="tile" style={{ animationDelay: `${index * 30}ms` }}>
                <span className="tile-art">
                  <img src={`/covers/cover-${game.id}.jpg`} alt="" />
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
