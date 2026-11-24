import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  flight: "blue", baccarat: "blue", pump: "magenta", diamonds: "teal", upgrader: "violet", hilo: "teal", keno: "violet", snakes: "violet",
  rps: "amber",
  farmyard: "amber", beacon: "teal", vault: "violet",
  packs: "indigo", cases: "teal", "case-battles": "red", rips: "magenta",
};
const historicNames = new Map([["derby", "pig-race"]]);
type Game = (typeof GAMES)[number];

function LinkedPlayerSkin({ player }: { player: string }) {
  const [id, setId] = useState(player.startsWith(".") ? "" : player);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!/^\.[A-Za-z0-9_]{1,16}$/.test(player)) return;
    const controller = new AbortController();
    const gamertag = player.slice(1).replaceAll("_", " ");
    fetch(`https://api.geysermc.org/v2/xbox/xuid/${encodeURIComponent(gamertag)}`,
      { signal: controller.signal, referrerPolicy: "no-referrer" })
      .then(response => response.ok ? response.json() : null)
      .then(profile => {
        if (typeof profile?.xuid !== "string" || !/^\d{1,20}$/.test(profile.xuid)) return;
        const hex = BigInt(profile.xuid).toString(16).padStart(16, "0");
        if (hex.length === 16) setId(`00000000-0000-0000-${hex.slice(0, 4)}-${hex.slice(4)}`);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [player]);
  if (!id || failed) return null;
  return <img className="lobby-player-skin" src={`https://mc-heads.net/body/${encodeURIComponent(id)}`}
    alt={`${player}’s game skin`} referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

const newArt = new Set(["pump", "diamonds", "upgrader"]);
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
        style={coverTones[game.id] ? { "--cover-object": `url("/covers/arcade/${game.id}-object.${newArt.has(game.id) ? "png" : "webp"}")` } as CSSProperties : undefined}>
        <span className="arcade-art" data-game={game.id} aria-hidden="true" />
        <strong>{game.name}</strong>
      </Link>)}
    </div>

  </section>;
}

export function ArcadeLobby() {
  const { query, setQuery, donutCashier, openDonutCashier } = useOutletContext<ShellContext>();
  const player = donutCashier.data?.wallet?.player;
  const { hash } = useLocation();
  const { history } = useWallet();
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
        {player && <LinkedPlayerSkin key={player} player={player} />}
        <h1>BlockBet Arcade</h1>
        <p>Explore all games and Packs.</p>
        <Link className="lobby-cta" to="/#originals" onClick={() => setQuery("")}>Explore games</Link>
      </section>
      <section className="arcade-hero-card lobby-wallet-card">
        <div className="arcade-art" data-game="account-coins" aria-hidden="true" />
        <h2>DSMP Wallet</h2>
        <p>Check your balance and recent activity.</p>
        <button className="lobby-cta" type="button" onClick={openDonutCashier}>Open wallet</button>
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
