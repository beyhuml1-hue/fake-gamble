import { useEffect, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { formatMult, formatUSD } from "../lib/money";
import { classic } from "../data/games";
import { useWallet } from "../state/wallet";

const historicalNames: Record<string, string> = { dragon: "Dragon Tower", diamonds: "Diamonds" };

export function GameLayout({ title, note, panel, children }: {
  title: string;
  note: string;
  panel: ReactNode;
  children: ReactNode;
}) {
  const { id = "" } = useParams();
  const { history } = useWallet();
  const recent = history.filter(row => row.game === title || row.game === historicalNames[id]).slice(0, 6);

  useEffect(() => {
    const previous = document.title;
    document.title = title + " · BlockBet";
    return () => { document.title = previous; };
  }, [title]);

  return (
    <section className="game-page play-surface" data-play={id} aria-label={title}>
      {!classic && <header className="arcade-game-heading">
        <Link to="/">Games</Link>
        <h1>{title}</h1>
      </header>}
      <div className="game-card">
        <div className="game-panel">{panel}</div>
        <div className="game-stage">{children}</div>
      </div>
      {(recent.length > 0 || (!classic && id === "flight")) && <section className="play-room-history" aria-label="Your recent results">
        <h2>{id === "flight" ? "Recent flights" : "Recent results"}</h2>
        {recent.length === 0 && <p>No flights yet.</p>}
        <div>{recent.map(row => <article key={row.id}>
          <small>{new Date(row.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
          <strong>{formatUSD(row.payout)}</strong>
          <span>{formatMult(row.payout / row.wager)}</span>
        </article>)}</div>
      </section>}
      <div className="play-footer"><Link to="/">‹ Games</Link><span>{note}</span></div>
    </section>
  );
}
