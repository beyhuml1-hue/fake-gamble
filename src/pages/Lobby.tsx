import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { ShellContext } from "../components/AppShell";
import { Icon } from "../components/Icons";
import { GAMES } from "../data/games";
import { formatCoins } from "../lib/money";
import { REFERRAL_COINS_CENTS, markReferral, referralReady } from "../lib/rewards";
import { useWallet } from "../state/wallet";
import { useAuth } from "../components/AuthProvider";
import { HomeSpotlight } from "./HomeSpotlight";

const order = ["mines","cases","case-battles","flip","blackjack","dice","dragon","mines-battles","coinflip","crash","uno","connect-four","poker","pool","chess","floor-is-lava","draw","rps","upgrader","hilo","limbo","plinko","double","roulette","pig-race","stocks","slide","keno","blitz","snakes","chicken","baccarat","diamonds","packs","wheel","pump","darts"];
const table = new Set(["blackjack","baccarat","roulette","hilo","poker","chess","uno","pool","connect-four"]);

function playingBase(id: string) {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 160 + 6;
}

export function Lobby() {
  const { query, setQuery } = useOutletContext<ShellContext>();
  const { history, grant } = useWallet();
  const { isGuest, canSignIn, showSignIn, showSignUp } = useAuth();
  const [referralOn, setReferralOn] = useState(referralReady);
  const [note, setNote] = useState("");
  const [tick, setTick] = useState(0);
  const q = query.trim().toLowerCase();
  const games = useMemo(() => [...GAMES].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).filter((game) =>
    !q || (game.name + " " + game.blurb).toLowerCase().includes(q)
  ), [q]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 7000);
    return () => window.clearInterval(timer);
  }, []);

  function claimReferral() {
    if (!referralReady()) { setNote("Referral reward already claimed on this browser."); return; }
    const got = grant(REFERRAL_COINS_CENTS);
    if (!got) { setNote("Balance is at the play-money cap."); return; }
    markReferral();
    setReferralOn(false);
    setNote("Claimed " + formatCoins(got) + " referral coins.");
  }

  const ticker = Array.from({ length: 8 }, (_, i) => (
    <button type="button" key={i} onClick={claimReferral}>Claim Referral · {formatCoins(REFERRAL_COINS_CENTS)} coins</button>
  ));

  return (
    <section className="lobby df-lobby">
      <article className="df-hero">
        <p className="df-kicker">Arcade</p>
        <h1>Play the floor</h1>
        <p>Originals, tables, and races settled in play coins. Big numbers, zero cash value.</p>
        <div className="df-hero-actions">
          {isGuest ? (
            <>
              <button className="df-btn df-btn-green" type="button" onClick={() => canSignIn ? showSignUp() : setNote("This browser is already on a local play-money profile.")}>Register</button>
              <button className="df-btn df-btn-ghost" type="button" onClick={() => canSignIn ? showSignIn() : setNote("This browser is already on a local play-money profile.")}>Sign In</button>
            </>
          ) : (
            <Link className="df-btn df-btn-green" to="/game/dice">Play Now</Link>
          )}
        </div>
      </article>

      <div className="df-ticker" aria-label="Claim referral">
        <div>{ticker}{ticker}</div>
      </div>
      {note && <p className="df-note" role="status">{note}</p>}

      <div className="df-promos">
        <Link to="/race" className="df-promo">
          <small>Daily leaderboard</small>
          <strong>Race</strong>
          <span>Climb today&apos;s board</span>
        </Link>
        <button type="button" className="df-promo" onClick={claimReferral} disabled={!referralOn}>
          <small>Referrals</small>
          <strong>{referralOn ? "Claim code" : "Claimed"}</strong>
          <span>{formatCoins(REFERRAL_COINS_CENTS)} play coins</span>
        </button>
        <Link to="/race" className="df-promo df-promo-vip" id="rewards">
          <small>Rewards</small>
          <strong>VIP</strong>
          <span>Daily drops and the race pool</span>
        </Link>
      </div>

      <div className="df-games-head" id="games">
        <h2>Games</h2>
        <label className="search lobby-search">
          <input type="search" aria-label="Search games" placeholder="Search games" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      {games.length ? (
        <div className="df-grid">
          {games.map((game) => {
            const playing = playingBase(game.id) + (tick % 5);
            return (
              <Link key={game.id} to={"/game/" + game.id} className="df-tile">
                <span className="df-tile-icon"><Icon name={game.id} /></span>
                <strong>{game.name}</strong>
                <small>{table.has(game.id) ? "ORIGINALS" : "ORIGINALS"}</small>
                <em><i />{playing} playing</em>
              </Link>
            );
          })}
        </div>
      ) : <p className="empty-row">No games found.</p>}

      <div className="df-banners">
        <button type="button" className="df-banner df-banner-gold" onClick={claimReferral}>
          <small>REWARDS</small>
          <strong>Claim Now</strong>
        </button>
        <Link to="/game/dice" className="df-banner df-banner-green">
          <small>FREE TO PLAY</small>
          <strong>Play Now</strong>
        </Link>
      </div>
      <HomeSpotlight history={history} />
    </section>
  );
}
