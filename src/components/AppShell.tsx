import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { GAMES } from "../data/games";
import { formatAmount, PEG_COPY, START_CENTS } from "../lib/money";
import { useWallet } from "../state/wallet";
import { BetsTable } from "./BetsTable";
import { Icon } from "./Icons";

export type ShellContext = { query: string };

export function AppShell() {
  const { balance, refill, setPracticeBalance } = useWallet();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [draft, setDraft] = useState("1000.00");
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const applyDraft = () => {
    const dollars = Number(draft);
    if (!Number.isFinite(dollars) || dollars < 0) return;
    setPracticeBalance(Math.round(dollars * 100));
    setWalletOpen(false);
  };

  return (
    <div className="app">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <NavLink to="/" className="brand" end>
          <span className="brand-mark">$</span>
          <span>
            <strong>Fake Gamble</strong>
            <small>Play USD</small>
          </span>
        </NavLink>

        <p className="nav-label">Play</p>
        <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
          <Icon name="casino" />
          Casino
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

        <p className="side-note">18+ · Play money · No slots</p>
      </aside>
      {open ? <button className="scrim" type="button" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}

      <div className="main">
        <header className="header">
          <button className="menu-btn" type="button" aria-label="Open menu" onClick={() => setOpen(true)}>
            <span />
            <span />
            <span />
          </button>
          <label className="search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              placeholder="Search originals"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="wallet-pill">
            <span className="usd-mark">$</span>
            <span className="bal">
              <strong>{formatAmount(balance)}</strong>
              <small>USD</small>
            </span>
            <button type="button" className="wallet-btn" onClick={() => setWalletOpen(true)}>
              Wallet
            </button>
          </div>
        </header>

        <div className="content">
          <Outlet context={{ query } satisfies ShellContext} />
          <BetsTable />
          <footer className="site-foot">
            <p>Practice only. Play USD cannot be withdrawn. If gambling is a problem, visit ncpgambling.org or call 1-800-GAMBLER.</p>
          </footer>
        </div>
      </div>

      {walletOpen ? (
        <div className="modal-back" role="presentation" onClick={() => setWalletOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-labelledby="wallet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="wallet-title">Play USD wallet</h2>
            <p className="peg">{PEG_COPY}</p>
            <p className="wallet-balance">
              <span>Balance</span>
              <strong>{formatAmount(balance)} USD</strong>
            </p>
            <label className="field">
              <span className="field-label">Set practice balance</span>
              <span className="amount">
                <span className="amount-prefix">$</span>
                <input value={draft} inputMode="decimal" onChange={(event) => setDraft(event.target.value)} />
              </span>
            </label>
            <div className="modal-actions">
              <button
                className="ghost-btn"
                type="button"
                onClick={() => {
                  refill();
                  setDraft((START_CENTS / 100).toFixed(2));
                }}
              >
                Refill $1,000
              </button>
              <button className="bet-btn" type="button" onClick={applyDraft}>
                Save balance
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
