import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useLocation, useOutletContext } from "react-router-dom";
import type { ShellContext } from "../components/AppShell";
import { ArcadeHeroArt, DiscordHeroArt, GiftHeroArt } from "../components/DepoArt";
import { gameArtUrl } from "../lib/gameArt";
import { CASE_TILES, ORIGINAL_TILES, TILE_BORDER, type LobbyTile } from "../data/lobbyTiles";
import { GAMES } from "../data/games";
import { formatCoins } from "../lib/money";
import { REFERRAL_COINS_CENTS, markReferral, referralReady } from "../lib/rewards";
import { useWallet } from "../state/wallet";
import { HomeSpotlight } from "./HomeSpotlight";

const DISCORD = "https://discord.gg/Xh8mkKxPcm";

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

function TabIcon({ name }: { name: string }) {
  if (name === "lobby") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }
  if (name === "originals") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 3l2.2 6.4H21l-5.4 4 2 6.6L12 16.8 6.4 20l2-6.6L3 9.4h6.8z" />
      </svg>
    );
  }
  if (name === "cases") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="4" y="8" width="16" height="10" rx="2" />
        <path d="M8 8V6h8v2M12 8v10" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function Tile({ tile }: { tile: LobbyTile }) {
  const style = { "--tile": TILE_BORDER[tile.tone] ?? "#3b82f6" } as CSSProperties;
  const src = gameArtUrl(tile.art);
  const body = (
    <>
      {src ? <img className="depo-tile-art" src={src} alt="" draggable={false} /> : <span className="arcade-art depo-tile-art" data-game={tile.gameId ?? tile.art} aria-hidden="true" />}
      <strong>{tile.name}</strong>
    </>
  );
  if (!tile.gameId) {
    return (
      <div className="depo-tile is-soon" style={style} aria-label={`${tile.name} is not in this arcade yet`}>
        {body}
      </div>
    );
  }
  return (
    <Link className="depo-tile" style={style} to={"/game/" + tile.gameId}>
      {body}
    </Link>
  );
}

export function Lobby() {
  const { query, setQuery } = useOutletContext<ShellContext>();
  const { history, grant } = useWallet();
  const { hash } = useLocation();
  const [referralOn, setReferralOn] = useState(referralReady);
  const [note, setNote] = useState("");
  const q = query.trim().toLowerCase();
  const tab = hash === "#cases" || hash === "#slots" || hash === "#originals" || hash === "#recent" ? hash.slice(1) : "lobby";

  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  const recent = useMemo(() => {
    const seen = new Set<string>();
    const tiles: LobbyTile[] = [];
    for (const row of history) {
      const game = GAMES.find((item) => item.name.toLowerCase() === row.game.toLowerCase());
      if (!game || seen.has(game.id)) continue;
      seen.add(game.id);
      const known = [...ORIGINAL_TILES, ...CASE_TILES].find((item) => item.gameId === game.id);
      tiles.push(known ?? { id: game.id, name: game.name, art: game.id, tone: "blue", gameId: game.id });
      if (tiles.length === 8) break;
    }
    return tiles;
  }, [history]);

  const caseTiles = CASE_TILES.filter((tile) => tile.gameId === "cases" || tile.gameId === "case-battles" || tile.gameId === "packs");
  const tiles = tab === "cases" ? caseTiles : tab === "recent" ? recent : tab === "slots" ? [] : ORIGINAL_TILES;
  const visible = tiles.filter((tile) => !q || tile.name.toLowerCase().includes(q));
  const heading = tab === "cases" ? "Cases" : tab === "slots" ? "Slots" : tab === "recent" ? "Recently played" : "DonutFlip Originals";

  function claimReferral() {
    if (!referralReady()) {
      setNote("Referral reward already claimed on this browser.");
      return;
    }
    const got = grant(REFERRAL_COINS_CENTS);
    if (!got) {
      setNote("Balance is at the play-money cap.");
      return;
    }
    markReferral();
    setReferralOn(false);
    setNote("Claimed " + formatCoins(got) + " referral coins. Play money only.");
  }

  return (
    <section className="lobby depo-lobby">
      <div className="depo-heroes">
        <article className="depo-hero depo-hero-arcade">
          <div className="depo-hero-copy">
            <h2><span>DonutFlip</span><span>Arcade</span></h2>
            <p>Slots, originals and more for DonutFlip players.</p>
            <Link className="depo-cta depo-cta-green" to="/#originals">Explore games</Link>
          </div>
          <ArcadeHeroArt />
        </article>
        <article className="depo-hero depo-hero-refer" id="refer">
          <div className="depo-hero-copy">
            <h2><span>Refer</span><span>&amp; Earn</span></h2>
            <p>Invite friends and claim {formatCoins(REFERRAL_COINS_CENTS)} play coins.</p>
            <button className="depo-cta depo-cta-pink" type="button" onClick={claimReferral} disabled={!referralOn}>
              {referralOn ? "Invite & earn" : "Claimed"}
            </button>
          </div>
          <GiftHeroArt />
        </article>
        <article className="depo-hero depo-hero-discord">
          <div className="depo-hero-copy">
            <h2><span>Join</span><span>Discord</span></h2>
            <p>Join the DonutFlip community. Chat, get updates, and stay connected.</p>
            <a className="depo-cta depo-cta-lilac" href={DISCORD} target="_blank" rel="noopener noreferrer">Join Discord</a>
          </div>
          <DiscordHeroArt />
        </article>
      </div>
      {note && <p className="depo-note" role="status">{note}</p>}

      <div className="depo-toolbar">
        <nav className="depo-tabs" aria-label="Lobby sections">
          {[
            ["lobby", "Lobby", "/"],
            ["originals", "Originals", "/#originals"],
            ["cases", "Cases", "/#cases"],
            ["slots", "Slots", "/#slots"],
          ].map(([id, label, href]) => (
            <Link key={id} to={href} className={tab === id ? "on" : ""} aria-current={tab === id ? "page" : undefined}>
              <TabIcon name={id} />
              {label}
            </Link>
          ))}
        </nav>
        <label className="depo-search">
          <IconSearch />
          <input id="depo-search" type="search" aria-label="Search games" placeholder="Search games" value={query} onChange={(event) => setQuery(event.target.value)} />
          <kbd>Ctrl K</kbd>
        </label>
      </div>

      <section id={tab === "lobby" ? "originals" : tab} aria-labelledby="depo-grid-title">
        <h2 className="depo-originals-head" id="depo-grid-title">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.8 5.7 20.8 8 13.6 2 9.2h7.6z" /></svg>
          {heading}
        </h2>
        {tab === "slots" ? (
          <p className="depo-empty">No slot games in this play-money arcade yet.</p>
        ) : visible.length ? (
          <div className="depo-grid">
            {visible.map((tile) => <Tile key={tile.id} tile={tile} />)}
          </div>
        ) : (
          <p className="depo-empty">{tab === "recent" ? "Play a game and it will show up here." : "No games found."}</p>
        )}
      </section>
      <HomeSpotlight history={history} />
    </section>
  );
}
