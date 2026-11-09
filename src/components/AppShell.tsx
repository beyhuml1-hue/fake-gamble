import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { GAMES } from "../data/games";
import { useAuth } from "./AuthProvider";
import { formatAmount } from "../lib/money";
import { sound } from "../lib/sound";
import { useWallet } from "../state/wallet";
import { BetsTable } from "./BetsTable";
import { Cashier } from "./Cashier";
import { Icon } from "./Icons";

export type ShellContext = { query: string; setQuery: Dispatch<SetStateAction<string>> };

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
  const { email: accountEmail, isGuest, isAdmin, canSignIn, logout, showSignIn } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const { balance, cashierNonce, openCashier } = useWallet();
  const rolling = useRollingBalance(balance);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (cashierNonce > 0) setWalletOpen(true);
  }, [cashierNonce]);

  return (
    <div className="app">
      <aside className={open ? "sidebar open" : "sidebar"}>
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
        <a className="nav-item" href="/#live-bets">
          <span className="live-nav-dot" aria-hidden="true" />
          Live Bets
        </a>

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

        <p className="side-note">18+</p>
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
          <nav className="head-links">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "on" : "")}>
              Casino
            </NavLink>
            <NavLink to="/stats" className={({ isActive }) => (isActive ? "on" : "")}>
              Stats
            </NavLink>
            <a href="/#live-bets">Live Bets <span className="head-live-dot" aria-hidden="true" /></a>
          </nav>
          <div className={rolling.dir ? `wallet-pill ${rolling.dir}` : "wallet-pill"}>
            <span className="usd-mark">$</span>
            <span className="bal">
              <strong>{formatAmount(rolling.shown)}</strong>
              <small>Play USD</small>
            </span>
            <button type="button" className="wallet-btn" onClick={openCashier}>
              Wallet
            </button>
          </div>
          <button
            type="button"
            className="sound-btn"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => setMuted(sound.toggle())}
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
          <div className="account">
            <button type="button" className="avatar account-trigger" aria-label="Account menu"
              aria-expanded={accountOpen} onClick={() => setAccountOpen((v) => !v)}>
              {accountEmail ? accountEmail.charAt(0).toUpperCase() : "B"}
            </button>
            {accountOpen && (
              <div className="account-menu">
                <strong>{accountEmail || "Guest profile"}</strong>
                <p className="account-menu-note">{isGuest ? "Saved only in this browser" : "Verified email · wallet saved on this device"}</p>
                {isAdmin && <NavLink to="/admin" onClick={() => setAccountOpen(false)}>Manage accounts</NavLink>}
                {isGuest
                  ? (canSignIn
                      ? <button type="button" onClick={showSignIn}>Log in or sign up</button>
                      : <p className="account-menu-note">Email sign-in is not configured yet.</p>)
                  : <button type="button" onClick={() => { setAccountOpen(false); void logout(); }}>Sign out</button>}
              </div>
            )}
          </div>
        </header>

        <div className="content">
          <Outlet context={{ query, setQuery } satisfies ShellContext} />
          <BetsTable />
          <footer className="site-foot">
            <p>18+ · If gambling is a problem, visit ncpgambling.org or call 1-800-GAMBLER.</p>
          </footer>
        </div>
      </div>

      <Cashier open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}

