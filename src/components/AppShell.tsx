import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { GAMES } from "../data/games";
import { formatCoins } from "../lib/money";
import { DAILY_COINS_CENTS, REFERRAL_COINS_CENTS, dailyReady, markDaily, markReferral, referralReady } from "../lib/rewards";
import { sound } from "../lib/sound";
import { useWallet } from "../state/wallet";
import { Community } from "../pages/Community";
import { BetsTable } from "./BetsTable";
import { Cashier } from "./Cashier";
import { SiteFooter } from "./SiteFooter";
import { CoinMark, Icon } from "./Icons";
import { useAuth } from "./AuthProvider";

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

const GRANTS = [100, 1_000, 10_000];

export function AppShell() {
  const { displayName, isGuest, isAdmin, canSignIn, logout, showSignIn } = useAuth();
  const { balance, cashierNonce, openCashier, notifications, dismissNotification, grant } = useWallet();
  const rolling = useRollingBalance(balance);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<"" | "games" | "rewards" | "lang" | "funds" | "account">("");
  const [chatOpen, setChatOpen] = useState(() => window.matchMedia("(min-width: 980px)").matches);
  const [muted, setMuted] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [rewardNote, setRewardNote] = useState("");
  const [dailyOn, setDailyOn] = useState(dailyReady);
  const [referralOn, setReferralOn] = useState(referralReady);
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!location.hash && contentRef.current) contentRef.current.scrollTop = 0;
  }, [location.pathname, location.hash]);

  useEffect(() => { setMenu(""); }, [location.pathname]);
  useEffect(() => { if (cashierNonce > 0) { setWalletOpen(true); setMenu(""); } }, [cashierNonce]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".df-pop, .df-signin")) setMenu("");
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

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

  return (
    <div className={"app df-shell" + (chatOpen ? " chat-open" : "")}>
      <header className="df-nav">
        <div className="df-nav-left">
          <button className="df-icon-btn df-chat-toggle" type="button" aria-expanded={chatOpen} aria-label={chatOpen ? "Hide live chat" : "Show live chat"} onClick={() => setChatOpen((open) => !open)}>
            <span />
            <span />
            <span />
          </button>
          <NavLink to="/" className="df-logo" end>
            <Icon name="dice" />
            <span>DonutFlip</span>
          </NavLink>
          <div className="df-pop">
            <button type="button" className={"df-menu-btn df-games" + (menu === "games" ? " on" : "")} aria-expanded={menu === "games"} onClick={() => setMenu((m) => m === "games" ? "" : "games")}>
              Games <small>v</small>
            </button>
            {menu === "games" && (
              <div className="df-dropdown df-game-menu" role="menu">
                {GAMES.map((game) => (
                  <NavLink key={game.id} to={"/game/" + game.id} role="menuitem" onClick={() => setMenu("")}>
                    <Icon name={game.id} />
                    {game.name}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
          <div className="df-pop">
            <button type="button" className={"df-menu-btn df-rewards" + (menu === "rewards" ? " on" : "")} aria-expanded={menu === "rewards"} onClick={() => setMenu((m) => m === "rewards" ? "" : "rewards")}>
              Rewards <small>v</small>
            </button>
            {menu === "rewards" && (
              <div className="df-dropdown df-reward-menu" role="menu">
                <button type="button" disabled={!dailyOn} onClick={claimDaily}>{dailyOn ? "Claim daily reward" : "Daily reward claimed"}</button>
                <button type="button" disabled={!referralOn} onClick={claimReferral}>{referralOn ? "Claim referral" : "Referral claimed"}</button>
                <NavLink to="/race" onClick={() => setMenu("")}>Daily leaderboard</NavLink>
                <p>Play coins only. No cash value.</p>
                {rewardNote && <p role="status">{rewardNote}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="df-pop df-balance-wrap">
          <div className={rolling.dir ? `df-balance ${rolling.dir}` : "df-balance"}>
            <CoinMark />
            <strong>{formatCoins(rolling.shown)}</strong>
            <span>coins</span>
            <button type="button" className="df-plus" aria-label="Add play coins" aria-expanded={menu === "funds"} onClick={() => setMenu((m) => m === "funds" ? "" : "funds")}>+</button>
          </div>
          {menu === "funds" && (
            <div className="df-dropdown df-funds">
              <strong>Add play coins</strong>
              <p>Looks like a balance top-up. These coins cannot be withdrawn and have no cash value.</p>
              <div>
                {GRANTS.map((coins) => (
                  <button key={coins} type="button" onClick={() => addFunds(coins)}>{formatCoins(coins * 100)}</button>
                ))}
              </div>
              <button type="button" className="df-text" onClick={openCashier}>Use demo card</button>
              {rewardNote && <p role="status">{rewardNote}</p>}
            </div>
          )}
        </div>

        <div className="df-nav-right">
          <button type="button" className="df-icon-btn" aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted(sound.toggle())}>
            {muted ? "🔇" : "🔊"}
          </button>
          {isGuest ? (
            <button className="df-signin" type="button" onClick={() => { if (canSignIn) showSignIn(); else setRewardNote("Local play-money profile is already active."); setMenu("funds"); }}>
              Sign In
            </button>
          ) : (
            <div className="df-pop">
              <button type="button" className="df-signin" aria-expanded={menu === "account"} onClick={() => setMenu((m) => m === "account" ? "" : "account")}>
                {displayName || "Account"}
              </button>
              {menu === "account" && (
                <div className="df-dropdown df-account">
                  <strong>{displayName || "Player"}</strong>
                  <p>Verified profile · play coins</p>
                  {isAdmin && <NavLink to="/admin" onClick={() => setMenu("")}>Manage accounts</NavLink>}
                  <button type="button" onClick={() => { setMenu(""); void logout(); }}>Sign out</button>
                </div>
              )}
            </div>
          )}
          <div className="df-pop">
            <button type="button" className="df-flag" aria-label="Language" aria-expanded={menu === "lang"} onClick={() => setMenu((m) => m === "lang" ? "" : "lang")}>
              <svg viewBox="0 0 24 16" width="22" height="15" aria-hidden="true">
                <rect width="24" height="16" rx="2" fill="#1d4ed8" />
                <rect y="6" width="24" height="4" fill="#fff" />
                <rect x="10" width="4" height="16" fill="#fff" />
                <rect y="7" width="24" height="2" fill="#ef4444" />
                <rect x="11" width="2" height="16" fill="#ef4444" />
              </svg>
            </button>
            {menu === "lang" && (
              <div className="df-dropdown df-lang" role="menu">
                <button type="button" aria-pressed="true">English</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="df-body">
        <aside className="df-chat" aria-label="Live chat">
          <Community compact />
        </aside>
        <div className="main">
          <div className="content" ref={contentRef}>
            <Outlet context={{ query, setQuery } satisfies ShellContext} />
            {location.pathname !== "/chat" && <BetsTable />}
            <SiteFooter />
          </div>
        </div>
      </div>

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
