import { useEffect, useRef, type CSSProperties } from "react";
import { Link, useLocation, useOutletContext } from "react-router-dom";
import type { ShellContext } from "../components/AppShell";
import { Icon } from "../components/Icons";
import { GAMES, type GameId } from "../data/games";
import { useWallet } from "../state/wallet";
import { HomeSpotlight } from "./HomeSpotlight";
import "./arcade-lobby.css";

export const arcadeCategories = [
  { id: "originals", label: "Originals", icon: "dice" },
  { id: "packs", label: "Packs", icon: "packs" },
] as const;

const coverTones: Partial<Record<GameId, string>> = {
  dice: "blue", mines: "green", plinko: "magenta", roulette: "amber", coinflip: "blue",
  limbo: "amber", blackjack: "red", dragon: "indigo", slide: "indigo", crash: "red",
  flight: "blue", baccarat: "green", hilo: "teal", keno: "violet", snakes: "violet",
  digger: "teal", poison: "magenta", rps: "amber",
  farmyard: "amber", beacon: "teal", vault: "violet",
  packs: "indigo", cases: "teal", "case-battles": "red", rips: "magenta",
};
const historicNames = new Map([["derby", "pig-race"]]);
type Game = (typeof GAMES)[number];

const coverOrder = Object.keys(coverTones);
const catalog = [
  ...coverOrder.flatMap(id => GAMES.filter(game => game.id === id)),
  ...GAMES.filter(game => !coverTones[game.id]),
];

function gameCategory(id: string) {
  return id === "packs" ? "packs" : "originals";
}

function GameRow({ title, icon, games }: {
  title: string; icon: string; games: Game[];
}) {

  return <section className="lobby-game-row">
    <h2><Icon name={icon} />{title}</h2>
    <div className="arcade-grid">
      {games.map(game => <Link key={game.id} to={`/game/${game.id}`} className="arcade-tile"
        data-cover-tone={coverTones[game.id]} title={game.blurb}
        style={coverTones[game.id] ? { "--cover-object": `url("/covers/arcade/${game.id}-object.webp")` } as CSSProperties : undefined}>
        <span className="arcade-art" data-game={game.id} aria-hidden="true" />
        <strong>{game.name}</strong>
      </Link>)}
    </div>

  </section>;
}

export function ArcadeLobby() {
  const { query, setQuery } = useOutletContext<ShellContext>();
  const { hash } = useLocation();
  const { history, openCashier } = useWallet();
  const searchRef = useRef<HTMLInputElement>(null);
  const category = hash.slice(1);
  const recentOnly = category === "recent";
  const active = arcadeCategories.find(item => item.id === category);
  const term = query.trim().toLowerCase();
  const recentIds = new Set(history.map(record => {
    const key = record.game.toLowerCase();
    return historicNames.get(key) ?? catalog.find(game => game.name.toLowerCase() === key)?.id ?? key;
  }));
  const recentGames = [...recentIds].flatMap(id => catalog.filter(game => game.id === id));
  const games = (recentOnly ? recentGames : catalog).filter(game =>
    (!active || gameCategory(game.id) === active.id) &&
    (!term || `${game.name} ${game.blurb}`.toLowerCase().includes(term)));

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return <section className="lobby arcade-lobby blockbet-lobby">
    <div className="arcade-hero">
      <section className="arcade-hero-card arcade-account">
        <div className="voxel-scene" aria-hidden="true">
          <div className="voxel-person">
            {["head", "body", "arm-left", "arm-right", "leg-left", "leg-right"].map(part =>
              <div key={part} className={`voxel-part ${part}`}>
                {["front", "back", "left", "right", "top", "bottom"].map(face => <span key={face} className={face} />)}
              </div>)}
          </div>
        </div>
        <h1>BlockBet <span>Arcade</span></h1>
        <p>Explore all games and Packs.</p>
        <Link className="lobby-cta" to="/#originals" onClick={() => setQuery("")}>Explore games</Link>
      </section>
      <section className="arcade-hero-card lobby-wallet-card">
        <div className="arcade-art" data-game="account-coins" aria-hidden="true" />
        <h2>Play USD <span>Wallet</span></h2>
        <p>Check your balance and recent activity.</p>
        <button className="lobby-cta" type="button" onClick={openCashier}>Open wallet</button>
      </section>
    </div>

    <div className="arcade-toolbar">
      <nav className="lobby-tabs" aria-label="Game categories">
        <Link to="/" aria-current={!active && !recentOnly ? "page" : undefined} onClick={() => setQuery("")}><Icon name="casino" />Lobby</Link>
        {arcadeCategories.map(item =>
          <Link key={item.id} to={`/#${item.id}`} aria-current={active === item ? "page" : undefined}
            onClick={() => setQuery("")}><Icon name={item.icon} />{item.label}</Link>)}
      </nav>
      <label className="lobby-game-search">
        <Icon name="search" />
        <input ref={searchRef} type="search" aria-label="Search games" placeholder="Search games"
          value={query} onChange={event => setQuery(event.target.value)} />
        <kbd aria-hidden="true">Ctrl K</kbd>
      </label>
    </div>

    {recentOnly && games.length > 0 && <GameRow title="Recently played" icon="casino" games={games} />}
    {!recentOnly && arcadeCategories.map(item => {
      const rowGames = games.filter(game => gameCategory(game.id) === item.id);
      return rowGames.length > 0 && <GameRow key={item.id} title={item.id === "originals" ? "BlockBet Originals" : item.label}
        icon={item.icon} games={rowGames} />;
    })}
    {!games.length && <p className="empty-row">{recentOnly && !term ? "No recently played games yet." : "No games found."}</p>}
    <HomeSpotlight history={history} />
  </section>;
}
