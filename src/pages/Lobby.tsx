import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { ShellContext } from "../components/AppShell";
import { GAMES } from "../data/games";
import { HomeSpotlight } from "./HomeSpotlight";
import { formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";

const order = ["mines","cases","case-battles","flip","blackjack","dice","dragon","mines-battles","coinflip","crash","uno","connect-four","poker","pool","chess","floor-is-lava","draw","rps","upgrader","hilo","limbo","plinko","double","roulette","pig-race","stocks","slide","keno","blitz","snakes","chicken","baccarat","diamonds","packs","wheel","pump","darts"];
const table = new Set(["blackjack","baccarat","roulette","hilo","poker","chess","uno","pool","connect-four"]);
const groups = ["All games","Instant","Tables"] as const;

export function Lobby(){
  const {query,setQuery}=useOutletContext<ShellContext>();
  const { balance,history,openCashier }=useWallet();
  const [group,setGroup]=useState<typeof groups[number]>("All games");
  const q=query.trim().toLowerCase();
  const games=[...GAMES].sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id)).filter(game=>
    (group==="All games"||table.has(game.id)===(group==="Tables")) &&
    (!q||(game.name+" "+game.blurb).toLowerCase().includes(q)));
  return <section className="lobby arcade-lobby">
    <div className="arcade-hero">
      <section className="arcade-hero-card arcade-account">
        <div className="arcade-art" data-game="account-coins" aria-hidden="true"/>
        <p className="arcade-kicker">BlockBet</p><h1>Your table is ready</h1>
        <div className="arcade-wallet-stats">
          <div><small>Play USD balance</small><strong>{formatUSD(balance)}</strong></div>
          <div><small>Recent plays</small><strong>{history.length}</strong></div>
        </div>
        <button type="button" className="bet-btn" onClick={openCashier}>Open wallet</button>
        <p className="arcade-wallet-note">Play money · No cash value</p>
      </section>
      <Link to="/race" className="arcade-hero-card arcade-race-link">
        <div className="arcade-art" data-game="race" aria-hidden="true"/>
        <div><p className="arcade-kicker">Daily leaderboard</p><h2>Race</h2><span>View standings</span></div>
      </Link>
    </div>
    <div className="arcade-toolbar">
      <h2>Games</h2>
      <div className="chip-row" role="group" aria-label="Game categories">
        {groups.map(item=><button type="button" key={item} aria-pressed={item===group} onClick={()=>setGroup(item)}>{item}</button>)}
      </div>
      <label className="search lobby-search"><input type="search" aria-label="Search games" placeholder="Search games" value={query}
        onChange={event=>setQuery(event.target.value)}/></label>
    </div>
    {games.length?<div className="arcade-grid">
      {games.map(game=><Link key={game.id} to={"/game/"+game.id} className="arcade-tile">
        <span className="arcade-art" data-game={game.id} aria-hidden="true"/>
        <strong>{game.name}</strong>
      </Link>)}
    </div>:<p className="empty-row">No games found.</p>}
    <HomeSpotlight history={history} />
  </section>;
}
