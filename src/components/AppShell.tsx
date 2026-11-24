import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { GAMES, classic } from "../data/games";
import { useAuth } from "./AuthProvider";
import { formatAmount } from "../lib/money";
import { sound } from "../lib/sound";
import { useWallet } from "../state/wallet";
import { BetsTable } from "./BetsTable";
import { DonutCashier, dsmp, useDonutCashier } from "./DonutCashier";
import { Icon } from "./Icons";
import { Community } from "../pages/Community";
import { arcadeCategories } from "../pages/ArcadeLobby";

export type ShellContext = {
  query: string; setQuery: Dispatch<SetStateAction<string>>; muted: boolean; toggleSound: () => void;
  donutCashier: ReturnType<typeof useDonutCashier>; openDonutCashier: () => void;
};

function useRollingBalance(cents: number) {
  const [shown, setShown] = useState(cents);
  const current = useRef(cents);
  const [dir, setDir] = useState<"" | "up" | "down">("");

  useEffect(() => {
    const start = current.current;
    if (start === cents) return;
    setDir(cents > start ? "up" : "down");
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / 520);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(start + (cents - start) * eased);
      current.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    const clear = window.setTimeout(() => setDir(""), 680);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(clear);
    };
  }, [cents]);

  return { shown, dir };
}

export function AppShell() {
  const [siteStyle, setSiteStyle] = useState<"classic" | "studio">(() => {
    try { return localStorage.getItem("blockbet.site-style") === "studio" ? "studio" : "classic"; } catch { return "classic"; }
  });
  function updateSiteStyle(style: "classic" | "studio") {
    setSiteStyle(style);
    try { localStorage.setItem("blockbet.site-style", style); } catch { /* unavailable */ }
  }
  const { displayName, isGuest, canSignIn, logout, showSignIn, showSignUp } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const { balance, cashierNonce, notifications, dismissNotification } = useWallet();
  const rolling = useRollingBalance(balance);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [lobbyNavCollapsed, setLobbyNavCollapsed] = useState(false);
  const donutCashier = useDonutCashier(!isGuest);
  const donut = donutCashier.data;
  const [donutOpen, setDonutOpen] = useState(false);
  const promptedLink = useRef(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [muted, setMuted] = useState(() => sound.muted);
  const toggleSound = () => setMuted(sound.toggle());
  const location = useLocation();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const anchor = document.getElementById(location.hash.slice(1));
    if (anchor) {
      anchor.scrollIntoView();
    } else if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [location.pathname, location.hash]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (cashierNonce > 0) setDonutOpen(true);
  }, [cashierNonce]);

  useEffect(() => {
    if (donut?.configured && !donut.wallet && !promptedLink.current) {
      promptedLink.current = true;
      setDonutOpen(true);
    }
    if (isGuest) {
      promptedLink.current = false;
      setDonutOpen(false);
    } else {
      try {
        if (sessionStorage.getItem("blockbet.return-to-wallet") === "yes") {
          sessionStorage.removeItem("blockbet.return-to-wallet");
          promptedLink.current = true;
          setDonutOpen(true);
        }
      } catch { /* Storage may be blocked. */ }
    }
  }, [donut?.configured, donut?.wallet, isGuest]);

  const practiceGame = location.pathname.startsWith("/game/") && location.pathname !== "/game/coinflip";
  const useDsmp = !practiceGame;
  const showChat = chatOpen && location.pathname !== "/chat";
  const arcadeChrome = !classic;
  const lobbyNavClass = (hash: string) => location.hash === hash ? "nav-item active" : "nav-item";
  const resetSearch = () => {
    setQuery("");
    setOpen(false);
  };

  return (
    <div className={"app arcade-shell crafted" + (classic ? "" : " blockbet-edition") + (arcadeChrome ? " lobby-home-shell" : "") + (arcadeChrome && lobbyNavCollapsed ? " lobby-nav-collapsed" : "") + (showChat ? " with-live-chat" : "") + (location.pathname.startsWith("/game/") ? " game-shell" : "") + (siteStyle === "studio" ? " studio-style" : "")}>
      <aside className={open ? "sidebar open" : "sidebar"}>
        {arcadeChrome ? <>
          <div className="lobby-side-top">
            <button type="button" className="lobby-side-menu lobby-desktop-menu" aria-label="Toggle navigation"
              aria-expanded={!lobbyNavCollapsed} onClick={() => setLobbyNavCollapsed(value => !value)}>☰</button>
            <button type="button" className="lobby-side-menu lobby-mobile-menu" aria-label="Close navigation"
              onClick={() => setOpen(false)}>×</button>
          </div>
          <form className="lobby-side-search" onSubmit={event => {
            event.preventDefault();
            setOpen(false);
            navigate("/");
          }}>
            <Icon name="search" />
            <input type="search" aria-label="Search games from sidebar" placeholder="Search games"
              value={query} onChange={event => setQuery(event.target.value)} />
          </form>
          <nav className="lobby-side-links" aria-label="Arcade navigation">
            <div>
              <Link to="/" className={location.pathname === "/" ? lobbyNavClass("") : "nav-item"} aria-current={location.pathname === "/" && !location.hash ? "page" : undefined}
                onClick={resetSearch}><Icon name="casino" />Home</Link>
              <Link to="/#recent" className={lobbyNavClass("#recent")} aria-current={location.hash === "#recent" ? "page" : undefined}
                onClick={resetSearch}><Icon name="stats" />Recently played</Link>
            </div>
            <div>
              {arcadeCategories.map(item => <Link key={item.id} to={"/#" + item.id}
                className={lobbyNavClass("#" + item.id)} aria-current={location.hash === "#" + item.id ? "page" : undefined}
                onClick={resetSearch}><Icon name={item.icon} />{item.label}</Link>)}
            </div>
            <div>
              <NavLink to="/race" className="nav-item"><Icon name="stats" />Leaderboard</NavLink>
              <NavLink to="/stats" className="nav-item"><Icon name="stats" />Stats</NavLink>
              <Link to="/#live-bets" className={lobbyNavClass("#live-bets")}><span className="live-nav-dot" />Live Bets</Link>
            </div>
            <div>
              <NavLink to="/chat" className="nav-item"><Icon name="chat" />Community chat</NavLink>
              <a href="/classic/" className="nav-item"><Icon name="casino" />Classic arcade</a>
            </div>
          </nav>
        </> : <>
        <NavLink to="/" className="brand" end>
          <span className="brand-mark">B</span>
          <span>
            <strong>BlockBet</strong>
            <small>Play USD</small>
          </span>
        </NavLink>

        <p className="nav-label">Play</p>
        <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
          <Icon name="casino" />
          Casino
        </NavLink>
        <NavLink to="/stats" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
          <Icon name="stats" />
          Stats
        </NavLink>
        <NavLink to="/race" className={({isActive}) => isActive?"nav-item active":"nav-item"}>Race</NavLink>
        <NavLink className="nav-item" to="/#live-bets">
          <span className="live-nav-dot" aria-hidden="true" />
          Live Bets
        </NavLink>

        <NavLink to="/chat" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <span className="live-nav-dot" aria-hidden="true" /> Chat
        </NavLink>

        <p className="nav-label">Originals</p>
        <nav className="game-nav">
          {GAMES.map((game) => (
            <NavLink
              key={game.id}
              to={`/game/${game.id}`}
              className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
            >
              <Icon name={game.id} />
              {game.name}
            </NavLink>
          ))}
        </nav>

        <div className="site-style-control"><label htmlFor="site-style-select">Appearance</label><select id="site-style-select" value={siteStyle} onChange={event => updateSiteStyle(event.target.value === "studio" ? "studio" : "classic")}><option value="classic">Classic BlockBet</option><option value="studio">Dark studio</option></select></div><p className="side-note">18+</p>
        </>}
      </aside>
      {open ? <button className="scrim" type="button" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}

      <div className="main">
        <header className="header">
          <button className="menu-btn" type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <span />
            <span />
            <span />
          </button>
          <NavLink to="/" className="mobile-brand" end>BlockBet</NavLink>
          {arcadeChrome && <NavLink to="/" className="lobby-header-games" onClick={resetSearch}>
            <Icon name="casino" />Games
          </NavLink>}
          <nav className="head-links">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "on" : "")}>
              Games
            </NavLink>
            <NavLink to="/stats" className={({ isActive }) => (isActive ? "on" : "")}>
              Stats
            </NavLink>
            <NavLink to="/race">Race</NavLink>
            <a href="/#live-bets">Live Bets <span className="head-live-dot" aria-hidden="true" /></a>
          </nav>
          {(!arcadeChrome || !isGuest || !canSignIn) && <div className={rolling.dir ? `wallet-pill ${rolling.dir}` : "wallet-pill"}>
            <span className="usd-mark">$</span>
            <span className="bal">
              <strong>{useDsmp ? dsmp(donut?.wallet?.balance ?? 0) : formatAmount(rolling.shown)}</strong>
              <small>{useDsmp ? "DonutSMP balance" : "Practice credits"}</small>
            </span>
            <button type="button" className="wallet-btn" aria-label="Open DSMP wallet"
              onClick={() => setDonutOpen(true)}>
              Wallet
            </button>
          </div>}
          <button
            type="button"
            className="sound-btn"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={toggleSound}
          >
            {muted ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 10v4h3l4 3V7L7 10H4zM16 9l5 6M21 9l-5 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 10v4h3l4 3V7L7 10H4zM16 9a4 4 0 0 1 0 6M18.5 7a7 7 0 0 1 0 10" />
              </svg>
            )}
          </button>
          {isGuest && canSignIn && <>
            {arcadeChrome && <button type="button" className="lobby-header-chat" aria-label="Toggle live chat"
              aria-expanded={chatOpen} onClick={() => setChatOpen(value => !value)}><Icon name="chat" /></button>}
            <button className="header-sign-in" type="button" onClick={showSignIn}>{arcadeChrome ? "Log in" : "Sign in"}</button>
            {arcadeChrome && <button className="lobby-sign-up" type="button" onClick={showSignUp}>Register</button>}
          </>}
          <div className="account">
            <button type="button" className="avatar account-trigger" aria-label="Account menu"
              aria-expanded={accountOpen} onClick={() => setAccountOpen((v) => !v)}>
              {displayName?.charAt(0) || "B"}
            </button>
            {accountOpen && (
              <div className="account-menu">
                <strong>{displayName || "Guest profile"}</strong>
                <p className="account-menu-note">{isGuest ? "Saved only in this browser" : "Verified email · synced Play USD wallet"}</p>
                {isGuest
                  ? (canSignIn
                      ? <button type="button" onClick={showSignIn}>Log in or sign up</button>
                      : <p className="account-menu-note">Email sign-in is not configured yet.</p>)
                  : <button type="button" onClick={() => { setAccountOpen(false); void logout(); }}>Sign out</button>}
              </div>
            )}
          </div>
        </header>

        <div className="content" ref={contentRef}>
          <Outlet context={{ query, setQuery, muted, toggleSound, donutCashier,
            openDonutCashier: () => setDonutOpen(true) } satisfies ShellContext} />
          {location.pathname !== "/chat" && <BetsTable />}
          <footer className="site-foot">
            <p>{donut?.configured ? "DonutSMP uses in-game currency. Practice credits cannot be withdrawn." : "Play money only - no real value."}</p>
          </footer>
        </div>
      </div>

      {location.pathname !== "/chat" && <button type="button" className={"chat-drawer-toggle"+(chatOpen?" active":"")} aria-expanded={chatOpen}
        aria-label={chatOpen?"Close live chat":"Open live chat"} onClick={()=>setChatOpen(v=>!v)}>
        <Icon name={chatOpen?"close":"chat"}/> <span>{chatOpen?"Close chat":"Live chat"}</span>
      </button>}
      {showChat&&<aside className="chat-drawer" aria-label="Live BlockBet chat">
        <header className="chat-drawer-head"><div><strong>Live chat</strong><small>BlockBet community</small></div>
          <button type="button" aria-label="Close chat" onClick={()=>setChatOpen(false)}>✕</button>
        </header>
        <Community compact/>
      </aside>}
      {notifications.length>0&&<section className={"transfer-notifications"+(chatOpen?" drawer-open":"")} role="region" aria-label="Transfer notifications">
        {notifications.map(item=><div key={item.id} className="transfer-notification" role="status">
          <span className="transfer-notification-icon">✦</span>
          <div><b>Play USD received</b><p>{item.sender} sent you <strong>{formatAmount(item.cents)} Play USD</strong>.</p></div>
          <button type="button" aria-label="Dismiss transfer notification" onClick={()=>dismissNotification(item.id)}>✕</button>
        </div>)}
      </section>}
      <DonutCashier open={donutOpen} onClose={() => setDonutOpen(false)} cashier={donutCashier} signedIn={!isGuest}
        onSignIn={() => {
          try { sessionStorage.setItem("blockbet.return-to-wallet", "yes"); } catch { /* Storage may be blocked. */ }
          setDonutOpen(false);
          showSignIn();
        }} />
    </div>
  );
}
