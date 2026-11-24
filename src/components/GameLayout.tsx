import { useEffect, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { gameById } from "../data/games";
import { gameArtUrl } from "../lib/gameArt";
import { formatCoins, formatMult } from "../lib/money";
import { useWallet } from "../state/wallet";

const rooms = new Set(["flip", "mines-battles", "uno", "connect-four", "poker", "pool", "chess", "case-battles"]);
const historicalNames: Record<string,string> = {dragon:"Dragon Tower", diamonds:"Diamonds"};

export function GameLayout({ title, note, panel, children }: {
  title: string;
  note: string;
  panel: ReactNode;
  children: ReactNode;
}) {
  const {id = ""} = useParams();
  const game = gameById(id);
  const art = gameArtUrl(id);
  const room = rooms.has(id);
  const {history} = useWallet();
  const recent = history.filter(row => row.game === title || row.game === historicalNames[id]).slice(0, 6);

  useEffect(() => {
    const previous = document.title;
    document.title = title + " · DonutFlip";
    return () => { document.title = previous; };
  }, [title]);

  return (
    <section className={"game-page play-surface" + (room ? " play-room" : "")} data-play={id}>
      <header className="play-top">
        <div className="play-title">
          {art && <img className="play-game-art" src={art} alt="" draggable={false} />}
          <h1>{title}</h1>
          {room && <small>{id === "pool" ? "Solo practice" : "VS Computer"}</small>}
        </div>
        {room ? <p>{game?.blurb}</p> : <div className="play-history" aria-label="Your recent results">
          {recent.length ? recent.map(row => <span key={row.id} data-win={row.payout > row.wager}>
            {formatMult(row.payout / row.wager)}
          </span>) : <small>No recent plays</small>}
          <Link to="/stats">Stats</Link>
        </div>}
      </header>
      <div className="game-card">
        <div className="game-panel">{panel}</div>
        <div className="game-stage">{children}</div>
      </div>
      {room && recent.length > 0 && <section className="play-room-history">
        <h2>Recent games</h2>
        <div>{recent.map(row => <article key={row.id}>
          <small>{new Date(row.at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small>
          <strong>{formatCoins(row.payout)}</strong>
          <span>{formatMult(row.payout / row.wager)}</span>
        </article>)}</div>
      </section>}
      <div className="play-footer"><Link to="/">‹ Games</Link><span>{note}</span><small>Play coins · no cash value</small></div>
    </section>
  );
}
