import { Link, useOutletContext } from "react-router-dom";
import type { ShellContext } from "../components/AppShell";
import { Icon } from "../components/Icons";
import { GAMES } from "../data/games";

export function Lobby() {
  const { query } = useOutletContext<ShellContext>();
  const q = query.trim().toLowerCase();
  const games = GAMES.filter((game) => !q || game.name.toLowerCase().includes(q) || game.blurb.toLowerCase().includes(q));

  return (
    <section className="lobby">
      <div className="lobby-head">
        <div>
          <h1>Originals</h1>
          <p>Same bet ticket on every table. No slots. Your balance is Play USD, pegged 1:1 to the dollar.</p>
        </div>
        <span className="count">{games.length} games</span>
      </div>
      {games.length === 0 ? (
        <p className="empty-row">No originals match that search.</p>
      ) : (
        <div className="tile-grid">
          {games.map((game) => (
            <Link key={game.id} to={`/game/${game.id}`} className="tile">
              <span className="tile-art" style={{ background: game.gradient }}>
                <Icon name={game.id} />
                <span className="tile-name">{game.name}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
