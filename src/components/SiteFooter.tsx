import { Link } from "react-router-dom";
import { GAMES } from "../data/games";

export function SiteFooter() {
  const games = GAMES.slice(0, 8);
  return (
    <footer className="df-footer">
      <div className="df-footer-cols">
        <div>
          <h2>Games</h2>
          {games.map((game) => <Link key={game.id} to={"/game/" + game.id}>{game.name}</Link>)}
        </div>
        <div>
          <h2>Platform</h2>
          <Link to="/race">Daily race</Link>
          <Link to="/stats">Stats</Link>
          <Link to="/#rewards">Rewards</Link>
          <Link to="/#games">Originals</Link>
        </div>
        <div>
          <h2>Support</h2>
          <a href="#fairness">Fairness</a>
          <a href="#feedback">Feedback</a>
          <span>18+ play-money only</span>
          <span>Help is in the live chat</span>
        </div>
        <div>
          <h2>Social</h2>
          <Link to="/chat">Live chat</Link>
          <Link to="/race">Leaderboard</Link>
          <Link to="/highlight">Highlights</Link>
          <span>No real-money socials</span>
        </div>
      </div>
      <p className="df-disclaimer">
        DonutFlip is not a real casino. Coins are play-money for this demo and have no real-world monetary value.
        There are no real deposits and no real withdrawals.
      </p>
    </footer>
  );
}
