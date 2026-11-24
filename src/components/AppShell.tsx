import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { GAMES } from "../data/games";
import { formatCoins } from "../lib/money";
import { DAILY_COINS_CENTS, REFERRAL_COINS_CENTS, dailyReady, markDaily, markReferral, referralReady } from "../lib/rewards";
import { sound } from "../lib/sound";
import { useWallet } from "../state/wallet";
import { Community } from "../pages/Community";
import { BetsTable } from "./BetsTable";
import { Cashier } from "./Cashier";
import { LogoMark } from "./DepoArt";
import { SiteFooter } from "./SiteFooter";
import { CoinMark } from "./Icons";
import { useAuth } from "./AuthProvider";

export type ShellContext = { query: string; setQuery: Dispatch<SetStateAction<string>> };

const DISCORD = "https://discord.gg/Xh8mkKxPcm";
const GRANTS = [100, 1_000, 10_000];

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

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function AppShell() {
  const { displayName, isGuest, isAdmin, canSignIn, logout, showSignIn } = useAuth();
  const { balance, cardBalance, cashierNonce, openCashier, notifications, dismissNotification, grant, withdrawToCard } = useWallet();
  const rolling = useRollingBalance(balance);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<"" | "games" | "rewards" | "funds" | "account" | "withdraw">("");
  const [accountFrom, setAccountFrom] = useState<"header" | "side">("header");
  const [navOpen, setNavOpen] = useState(() => window.matchMedia("(min-width: 900px)").matches);
  const [chatOpen, setChatOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [rewardNote, setRewardNote] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("10.00");
  const [dailyOn, setDailyOn] = useState(dailyReady);
  const [referralOn, setReferralOn] = useState(referralReady);
  const location = useLocation();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const initial = (displayName || "P").charAt(0).toUpperCase();

  useLayoutEffect(() => {
    if (!location.hash && contentRef.current) contentRef.current.scrollTop = 0;
  }, [location.pathname, location.hash]);

  useEffect(() => { setMenu(""); }, [location.pathname]);
  useEffect(() => { if (cashierNonce > 0) { setWalletOpen(true); setMenu(""); } }, [cashierNonce]);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 900px)");
    const sync = () => setNavOpen(wide.matches);
    wide.addEventListener("change", sync);
    return () => wide.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".depo-pop, .depo-support-panel, .depo-support-fab")) setMenu("");
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (location.pathname !== "/") navigate("/");
        window.setTimeout(() => document.getElementById("depo-search")?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [location.pathname, navigate]);

  function claimDaily() {
    if (!dailyReady()) { setRewardNote("Daily reward already claimed."); return; }
    const got = grant(DAILY_COINS_CENTS);
    if (!got) { setRewardNote("Balance is at the play-money cap."); return; }
    markDaily();
    setDailyOn(false);
    setRewardNote("Claimed " + formatCoins(got) + " play coins.");
  }

  function claimReferral() {
    if (!referralReady()) { setRewardNote("Referral reward already claimed."); return; }
    const got = grant(REFERRAL_COINS_CENTS);
    if (!got) { setRewardNote("Balance is at the play-money cap."); return; }
    markReferral();
    setReferralOn(false);
    setRewardNote("Referral claimed: " + formatCoins(got) + " play coins.");
  }

  function addFunds(coins: number) {
    const got = grant(coins * 100);
    setRewardNote(got ? "Added " + formatCoins(got) + " play coins." : "Balance is at the play-money cap.");
  }

  function withdraw(event: FormEvent) {
    event.preventDefault();
    const cents = Math.round(Number(withdrawAmount) * 100);
    if (!Number.isSafeInteger(cents)) { setRewardNote("Enter a play-coin amount."); return; }
    const error = withdrawToCard(cents);
    setRewardNote(error ?? "Moved " + formatCoins(cents) + " onto the demo card. No cash leaves this arcade.");
  }

  function go(path: string) {
    setNavOpen(window.matchMedia("(min-width: 900px)").matches ? true : false);
    navigate(path);
  }

  const hash = location.hash;
  const home = location.pathname === "/";
  const accountMenu = menu === "account" ? (
    <div className={"depo-menu" + (accountFrom === "header" ? " depo-menu-right" : "")} role="menu">
      <strong style={{ display: "block", padding: "6px 10px" }}>{displayName || "Player"}</strong>
      <p>Play-money profile. Coins have no cash value.</p>
      <button type="button" onClick={() => { setMenu(""); navigate("/stats"); }}>Stats</button>
      <button type="button" onClick={() => setMuted(sound.toggle())}>{muted ? "Unmute" : "Mute"}</button>
      {isAdmin && <NavLink to="/admin" onClick={() => setMenu("")}>Manage accounts</NavLink>}
      {isGuest ? (
        <button type="button" onClick={() => { setMenu(""); if (canSignIn) showSignIn(); }}>{canSignIn ? "Sign in" : "Local profile"}</button>
      ) : (
        <button type="button" onClick={() => { setMenu(""); void logout(); }}>Sign out</button>
      )}
    </div>
  ) : null;

  return (
    <div className={"app depo-shell" + (navOpen ? " nav-open" : "")}>
      <header className="depo-nav">
        <div className="depo-nav-left">
          <button className="depo-burger" type="button" aria-expanded={navOpen} aria-label={navOpen ? "Hide navigation" : "Show navigation"} onClick={() => setNavOpen((open) => !open)}>
            <span /><span /><span />
          </button>
          <NavLink to="/" className="depo-logo" end onClick={() => setQuery("")}>
            <LogoMark />
            <strong>DonutFlip</strong>
          </NavLink>
          <div className="depo-pop">
            <button type="button" className="depo-games" aria-expanded={menu === "games"} onClick={() => setMenu((item) => item === "games" ? "" : "games")}>
              <svg className="depo-mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
              <span className="depo-games-label">Games</span>
              <Glyph><path d="M6 9l6 6 6-6" /></Glyph>
            </button>
            {menu === "games" && (
              <div className="depo-menu" role="menu">
                {GAMES.map((game) => (
                  <NavLink key={game.id} to={"/game/" + game.id} role="menuitem" onClick={() => setMenu("")}>{game.name}</NavLink>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="depo-pop depo-balance-wrap">
          <div className={rolling.dir ? `depo-balance ${rolling.dir}` : "depo-balance"}>
            <CoinMark />
            <strong>{formatCoins(rolling.shown)}</strong>
            <button type="button" className="depo-plus" aria-label="Add play coins" aria-expanded={menu === "funds"} onClick={() => setMenu((item) => item === "funds" ? "" : "funds")}>+</button>
          </div>
          {menu === "funds" && (
            <div className="depo-menu depo-menu-right">
              <strong style={{ display: "block", padding: "6px 10px" }}>Add play coins</strong>
              <p>Looks like a balance top-up. These coins cannot be cashed out.</p>
              <div>
                {GRANTS.map((coins) => (
                  <button key={coins} type="button" onClick={() => addFunds(coins)}>{formatCoins(coins * 100)}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="depo-nav-right">
          <button type="button" className="depo-deposit" aria-label="Deposit play coins" onClick={openCashier}>
            <span className="depo-deposit-plus">+</span>
            <span className="depo-deposit-label">Deposit</span>
          </button>
          <div className="depo-pop">
            <button type="button" className="depo-withdraw" aria-label="Withdraw play coins" aria-expanded={menu === "withdraw"} onClick={() => setMenu((item) => item === "withdraw" ? "" : "withdraw")}>
              <svg className="depo-mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
              <span className="depo-withdraw-label">Withdraw</span>
            </button>
            {menu === "withdraw" && (
              <form className="depo-menu depo-menu-right" onSubmit={withdraw}>
                <strong style={{ display: "block", padding: "6px 10px" }}>Withdraw</strong>
                <p>Moves play coins onto the demo card in this browser. Nothing is paid out in cash. Card balance {formatCoins(cardBalance)}.</p>
                <input aria-label="Withdraw amount" inputMode="decimal" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} style={{ width: "100%", margin: "4px 0 8px", padding: "8px", borderRadius: 8, border: "1px solid #203d66", background: "#0b1730", color: "#fff" }} />
                <button type="submit">Move to demo card</button>
                {rewardNote && <p role="status">{rewardNote}</p>}
              </form>
            )}
          </div>
          <div className="depo-pop">
            <button type="button" className="depo-icon-btn" aria-label="Rewards" aria-expanded={menu === "rewards"} onClick={() => setMenu((item) => item === "rewards" ? "" : "rewards")}>
              <Glyph><path d="M3 17h18l-2-8-4 3-4-7-4 7-4-3z" /></Glyph>
            </button>
            {menu === "rewards" && (
              <div className="depo-menu depo-menu-right" role="menu">
                <button type="button" disabled={!dailyOn} onClick={claimDaily}>{dailyOn ? "Claim daily reward" : "Daily reward claimed"}</button>
                <button type="button" disabled={!referralOn} onClick={claimReferral}>{referralOn ? "Claim referral" : "Referral claimed"}</button>
                <NavLink to="/race" onClick={() => setMenu("")}>Daily leaderboard</NavLink>
                <p>Play coins only. No cash value.</p>
                {rewardNote && <p role="status">{rewardNote}</p>}
              </div>
            )}
          </div>
          <button type="button" className={"depo-icon-btn" + (chatOpen ? " on" : "")} aria-label={chatOpen ? "Hide chat" : "Show chat"} aria-expanded={chatOpen} onClick={() => setChatOpen((open) => !open)}>
            <Glyph><path d="M5 6h14v9H8l-3 3z" /></Glyph>
          </button>
          <div className="depo-pop">
            <button type="button" className="depo-avatar" aria-label="Account" aria-expanded={menu === "account" && accountFrom === "header"} onClick={() => { setAccountFrom("header"); setMenu((item) => item === "account" ? "" : "account"); }}>
              {initial}
            </button>
            {menu === "account" && accountFrom === "header" && accountMenu}
          </div>
        </div>
      </header>

      <div className="depo-body">
        <aside className={navOpen ? "depo-side open" : "depo-side"} aria-label="Arcade">
          <form className="depo-side-search" onSubmit={(event) => { event.preventDefault(); go("/"); }}>
            <Glyph><circle cx="11" cy="11" r="6" /><path d="M16 16l4 4" /></Glyph>
            <input type="search" aria-label="Search games" placeholder="Search games" value={query} onChange={(event) => setQuery(event.target.value)} />
          </form>
          <nav>
            <button type="button" className={"depo-side-link" + (home && !hash ? " on" : "")} onClick={() => go("/")}>
              <Glyph><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1z" /></Glyph>
              Home
            </button>
            <button type="button" className={"depo-side-link" + (hash === "#recent" ? " on" : "")} onClick={() => go("/#recent")}>
              <Glyph><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></Glyph>
              Recently Played
            </button>
            <hr className="depo-rule" />
            <button type="button" className={"depo-side-link" + (hash === "#originals" ? " on" : "")} onClick={() => go("/#originals")}>
              <Glyph><path d="M12 3l2.2 6.4H21l-5.4 4 2 6.6L12 16.8 6.4 20l2-6.6L3 9.4h6.8z" /></Glyph>
              Originals
            </button>
            <button type="button" className={"depo-side-link" + (hash === "#slots" ? " on" : "")} onClick={() => go("/#slots")}>
              <Glyph><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 8h6M9 12h6" /></Glyph>
              Slots
            </button>
            <button type="button" className={"depo-side-link" + (hash === "#cases" ? " on" : "")} onClick={() => go("/#cases")}>
              <Glyph><rect x="4" y="8" width="16" height="10" rx="2" /><path d="M8 8V6h8v2" /></Glyph>
              Cases
            </button>
            <button type="button" className="depo-side-link" onClick={() => go("/game/case-battles")}>
              <Glyph><path d="M4 16l6-8 4 5 6-7" /></Glyph>
              Case Battles
            </button>
            <button type="button" className="depo-side-link" onClick={() => go("/game/packs")}>
              <Glyph><rect x="7" y="4" width="10" height="16" rx="2" /><path d="M12 4v16" /></Glyph>
              Rips
            </button>
            <hr className="depo-rule" />
            <p className="depo-server">SERVER</p>
            <button type="button" className="depo-side-link" onClick={() => go("/race")}>
              <Glyph><path d="M8 4h8v3a4 4 0 0 1-8 0zM6 20h12M9 11v4M15 11v4" /></Glyph>
              Rewards
            </button>
            <button type="button" className="depo-side-link" onClick={() => go("/#refer")}>
              <Glyph><path d="M16 11a3 3 0 1 0-3-3M8 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 19a4 4 0 0 1 8 0M14 19a4 4 0 0 1 6 0" /></Glyph>
              Affiliate
            </button>
            <a className="depo-side-link" href={DISCORD} target="_blank" rel="noopener noreferrer">
              <Glyph><path d="M7 8c3-2 7-2 10 0M8 16l-1 3M16 16l1 3M9 13h.01M15 13h.01" /></Glyph>
              Discord
            </a>
          </nav>
          <div className="depo-side-foot">
            <div className="depo-pop">
              <button type="button" className="depo-profile" aria-expanded={menu === "account" && accountFrom === "side"} onClick={() => { setAccountFrom("side"); setMenu((item) => item === "account" ? "" : "account"); }}>
                <span><i>{initial}</i>Profile</span>
                <Glyph><path d="M6 9l6 6 6-6" /></Glyph>
              </button>
              {menu === "account" && accountFrom === "side" && accountMenu}
            </div>
            <button type="button" onClick={() => setSupportOpen(true)}>
              <Glyph><path d="M4 13a8 8 0 0 1 16 0v5h-3v-5a5 5 0 0 0-10 0v5H4z" /></Glyph>
              Live Support
            </button>
          </div>
        </aside>
        {navOpen && <button className="depo-scrim" type="button" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}
        <div className="main">
          <div className="content" ref={contentRef}>
            <Outlet context={{ query, setQuery } satisfies ShellContext} />
            {location.pathname !== "/chat" && <BetsTable />}
            <SiteFooter />
          </div>
        </div>
      </div>

      {chatOpen && location.pathname !== "/chat" && (
        <aside className="depo-chat-drawer" aria-label="Live chat">
          <Community compact />
        </aside>
      )}

      <button className="depo-support-fab" type="button" aria-label="Live support" onClick={() => setSupportOpen((open) => !open)}>
        <Glyph><path d="M4 13a8 8 0 0 1 16 0M6 13v5a2 2 0 0 0 2 2h1v-7H8a2 2 0 0 0-2 2zM18 13v5a2 2 0 0 1-2 2h-1v-7h1a2 2 0 0 1 2 2z" /></Glyph>
      </button>
      {supportOpen && (
        <section className="depo-support-panel" role="dialog" aria-label="Live support">
          <h2>Live support</h2>
          <p>DonutFlip is a play-money arcade. Coins have no cash value, and support cannot send real money, deposits, or withdrawals.</p>
          <p>Use live chat to tip play coins or join the rain pool.</p>
          <button type="button" onClick={() => { setSupportOpen(false); setChatOpen(true); }}>Open chat</button>
        </section>
      )}

      {notifications.length > 0 && (
        <section className="transfer-notifications" role="region" aria-label="Transfer notifications">
          {notifications.map((item) => (
            <div key={item.id} className="transfer-notification" role="status">
              <span className="transfer-notification-icon">✦</span>
              <div><b>Play coins received</b><p>{item.sender} sent you <strong>{formatCoins(item.cents)} coins</strong>.</p></div>
              <button type="button" aria-label="Dismiss transfer notification" onClick={() => dismissNotification(item.id)}>✕</button>
            </div>
          ))}
        </section>
      )}
      <Cashier open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
