import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";
import { CoinMark } from "../components/Icons";
import { maskName, rankFor, sanitizeChat, type Rank } from "../lib/chatText";
import { formatCoins, formatUSD } from "../lib/money";
import { rainShare } from "../lib/rain";
import { useWallet } from "../state/wallet";

type Player = { id: string; label: string };
type ServerMessage = { id: string; playerId: string; label: string; body: string; kind?: "chat" | "bigwin"; at: number };
type Board = {
  profile: Player;
  rain: { round: number; count: number; joined: 0 | 1; now: number; endsAt: number };
  messages: ServerMessage[];
  players: Player[];
};
type PublicStats = {
  bets: number; wins: number; losses: number; wageredCents: number; wonCents: number; lostCents: number; netCents: number;
};
type ChatRow = { id: string; name: string; body: string; at: number; serverId?: string };
type Rain = { round: number; pool: number; members: string[]; endsAt: number };
type Tab = "" | "vip" | "race" | "fairness" | "feedback";

const URL = "/api/auth/community";
const RAIN_KEY = "donutflip.rain.v1";
const CHAT_KEY = "donutflip.chat.v1";
const ROUND_MS = 90_000;
const YOU = "you";
const EMOJI = ["🎲", "💰", "🔥", "💎", "🎯", "🍀", "👑", "✨"];

function freshRain(now = Date.now()): Rain {
  return { round: now, pool: 2_500, members: ["Nova", "Jade", "Milo"], endsAt: now + ROUND_MS };
}

function readRain(): Rain {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(RAIN_KEY) || "") as Rain;
    if (parsed && Number.isFinite(parsed.endsAt) && Array.isArray(parsed.members) && Number.isSafeInteger(parsed.pool)) return parsed;
  } catch { /* new round */ }
  return freshRain();
}

function seedChat(now = Date.now()): ChatRow[] {
  return [
    { id: "seed-nova", name: "Nova", body: "Rain pool is open.", at: now - 90_000 },
    { id: "seed-jade", name: "Jade", body: "Sapphire upgrade just missed.", at: now - 54_000 },
    { id: "seed-milo", name: "Milo", body: "Good luck on the tables.", at: now - 22_000 },
  ];
}

function readChat(): ChatRow[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CHAT_KEY) || "") as ChatRow[];
    if (Array.isArray(parsed) && parsed.length) return parsed.slice(-80);
  } catch { /* seed */ }
  return seedChat();
}

function ChatBody({ text }: { text: string }) {
  return <p>{sanitizeChat(text)}</p>;
}

export function Community({ compact = false }: { compact?: boolean } = {}) {
  const { isGuest, canSignIn, showSignIn, displayName } = useAuth();
  const { walletReady, prepareTransfer, syncSocialWallet, debit, credit } = useWallet();
  const locked = isGuest && canSignIn;
  const [board, setBoard] = useState<Board | null>(null);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<ChatRow[]>(readChat);
  const [rain, setRain] = useState<Rain>(readRain);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<Tab>("");
  const [online, setOnline] = useState(86);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [heartOpen, setHeartOpen] = useState(false);
  const [rainTip, setRainTip] = useState("1.00");
  const [tipTarget, setTipTarget] = useState<{ name: string; serverId?: string } | null>(null);
  const [tipValue, setTipValue] = useState("1.00");
  const [selected, setSelected] = useState<Player | null>(null);
  const [playerStats, setPlayerStats] = useState<PublicStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [feedback, setFeedback] = useState("");
  const [offline, setOffline] = useState(false);
  const request = useRef(0);
  const lastTransfer = useRef<{ id: string; recipient: string; cents: number } | null>(null);
  const thread = useRef<HTMLDivElement>(null);
  const rolled = useRef<number | null>(null);
  const creditRef = useRef(credit);
  creditRef.current = credit;
  const me = displayName || "Player";

  const refresh = useCallback(async () => {
    const version = ++request.current;
    try {
      const response = await fetch(URL, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data: Board = await response.json();
      if (version !== request.current) return;
      setBoard(data);
      setOffline(false);
    } catch {
      if (version === request.current) setOffline(true);
    }
  }, []);

  useEffect(() => {
    if (isGuest) return;
    const poll = () => { if (!document.hidden) void refresh(); };
    poll();
    const timer = window.setInterval(poll, 5000);
    window.addEventListener("focus", poll);
    return () => {
      ++request.current;
      window.clearInterval(timer);
      window.removeEventListener("focus", poll);
    };
  }, [isGuest, refresh]);

  useEffect(() => {
    if (!board) return;
    setRows((prev) => {
      const ids = new Set(prev.map((row) => row.id));
      const extra = board.messages.filter((row) => !ids.has(row.id)).map((row) => ({
        id: row.id,
        name: row.label,
        body: sanitizeChat(row.body),
        at: row.at,
        serverId: row.playerId,
      }));
      return extra.length ? [...prev, ...extra].sort((a, b) => a.at - b.at).slice(-80) : prev;
    });
  }, [board]);

  useEffect(() => {
    try { sessionStorage.setItem(CHAT_KEY, JSON.stringify(rows.slice(-80))); } catch { /* ignore */ }
  }, [rows]);

  useEffect(() => {
    try { sessionStorage.setItem(RAIN_KEY, JSON.stringify(rain)); } catch { /* ignore */ }
  }, [rain]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setOnline((count) => Math.max(24, count + (Math.random() > 0.5 ? 1 : -1))), 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (now < rain.endsAt || rolled.current === rain.round) return;
    rolled.current = rain.round;
    const guard = "donutflip.rain.paid." + rain.round;
    let already = false;
    try {
      already = sessionStorage.getItem(guard) === "1";
      if (!already) sessionStorage.setItem(guard, "1");
    } catch { /* pay once for this mount */ }
    if (!already) {
      const share = rain.members.includes(YOU) ? rainShare(rain.pool, rain.members, YOU) : 0;
      if (share > 0) creditRef.current(share);
      setNotice(share > 0 ? "Rain paid " + formatCoins(share) + " coins." : "Rain round closed.");
    }
    setRain(freshRain(Date.now()));
  }, [now, rain]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRain((current) => {
        if (Date.now() >= current.endsAt) return current;
        const names = ["Rio", "Skye", "Quinn", "Lux", "Nico"];
        const members = current.members.length < 8 && current.members.length % 2 === 0
          ? [...current.members, names[current.members.length % names.length]!]
          : current.members;
        return { ...current, pool: current.pool + 75, members };
      });
    }, 12_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [rows]);

  useEffect(() => {
    if (!selected) { setPlayerStats(null); setStatsLoading(false); return; }
    let disposed = false;
    setPlayerStats(null);
    setStatsLoading(true);
    void fetch(URL + "?player=" + encodeURIComponent(selected.id), { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => { if (!disposed) setPlayerStats(data?.stats || null); })
      .catch(() => {})
      .finally(() => { if (!disposed) setStatsLoading(false); });
    return () => { disposed = true; };
  }, [selected?.id]);

  function pushRow(name: string, body: string, serverId?: string) {
    const clean = sanitizeChat(body);
    if (!clean) return;
    setRows((prev) => [...prev, { id: crypto.randomUUID(), name, body: clean, at: Date.now(), serverId }].slice(-80));
  }

  async function action(payload: object, onSuccess?: () => void) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Please try again.");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error && !(err instanceof SyntaxError) ? err.message : "Please try again.");
    } finally {
      await refresh();
      setBusy(false);
    }
  }

  function coinsOf(value: string) {
    const cents = Math.round(Number(value) * 100);
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(value.trim()) || cents < 1 || cents > 100_000_000) return null;
    return cents;
  }

  function joinRain() {
    if (locked) { showSignIn(); return; }
    if (rain.members.includes(YOU) || now >= rain.endsAt) return;
    setRain((current) => current.members.includes(YOU) ? current : { ...current, members: [...current.members, YOU] });
    setNotice("You joined the rain.");
  }

  function contributeRain(event: FormEvent) {
    event.preventDefault();
    if (locked) { showSignIn(); return; }
    const cents = coinsOf(rainTip);
    if (cents == null) { setError("Enter a tip from 0.01 to 1,000,000.00 coins."); return; }
    if (!debit(cents)) { setError("Not enough play coins."); return; }
    setRain((current) => ({ ...current, pool: current.pool + cents }));
    pushRow(me, "Added " + formatCoins(cents) + " coins to the rain.");
    setHeartOpen(false);
    setError("");
  }

  async function transferTo(person: Player, value: string) {
    const cents = coinsOf(value);
    if (cents == null) { setError("Enter an amount from 0.01 to 1,000,000.00 coins."); return; }
    if (!walletReady) { setError("Your main Play USD wallet is still syncing."); return; }
    setBusy(true);
    const available = await prepareTransfer();
    setBusy(false);
    if (available === null) { setError("Couldn't verify your current Play USD balance. Try again."); return; }
    if (cents > available) { setError("Your normal Play USD wallet doesn't have enough to send."); return; }
    const prior = lastTransfer.current;
    const id = prior?.recipient === person.id && prior.cents === cents ? prior.id : crypto.randomUUID();
    lastTransfer.current = { id, recipient: person.id, cents };
    void action({ action: "transfer", id, recipient: person.id, cents }, () => {
      lastTransfer.current = null;
      syncSocialWallet();
      setNotice("Sent " + formatUSD(cents) + " to " + person.label + ".");
      setSelected(null);
      setAmount("");
      setTipTarget(null);
    });
  }

  function tipPerson(event: FormEvent) {
    event.preventDefault();
    if (!tipTarget) return;
    if (locked) { showSignIn(); return; }
    if (tipTarget.serverId && board) {
      void transferTo({ id: tipTarget.serverId, label: tipTarget.name }, tipValue);
      return;
    }
    const cents = coinsOf(tipValue);
    if (cents == null) { setError("Enter a tip from 0.01 to 1,000,000.00 coins."); return; }
    if (!debit(cents)) { setError("Not enough play coins."); return; }
    pushRow(me, "Tipped " + formatCoins(cents) + " coins to " + maskName(tipTarget.name) + ".");
    setTipTarget(null);
    setError("");
  }

  function send(event: FormEvent) {
    event.preventDefault();
    if (locked) { showSignIn(); return; }
    const body = sanitizeChat(message);
    if (!body) { setError("Messages are plain text."); return; }
    if (!isGuest) {
      void action({ action: "message", body }, () => setMessage(""));
      return;
    }
    pushRow(me, body);
    setMessage("");
    setError("");
  }

  const seconds = Math.max(0, Math.ceil((rain.endsAt - now) / 1000));
  const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const joined = rain.members.includes(YOU);

  return (
    <section className={compact ? "community-page community-compact df-live" : "community-page df-live"}>
      <header className="df-live-head">
        <strong>LIVE CHAT</strong>
        <span><i />{online} ONLINE</span>
      </header>
      <div className="df-tabs" role="tablist">
        {(["vip", "race", "fairness", "feedback"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab((current) => current === id ? "" : id)}>
            {id === "vip" ? "VIP" : id === "race" ? "Race" : id === "fairness" ? "Fairness" : "Feedback"}
          </button>
        ))}
      </div>
      <section className="df-rain" aria-label="Rain pool">
        <CoinMark size={18} />
        <div>
          <strong>{formatCoins(rain.pool)}</strong>
          <small>{rain.members.length} joined · {countdown}</small>
        </div>
        <button className="df-join" type="button" disabled={locked || joined || seconds === 0} onClick={joinRain}>
          {joined ? "Joined" : "Join"}
        </button>
      </section>

      {error && <p className="neg df-live-note" role="alert">{error}</p>}
      {notice && <p className="pos df-live-note" role="status">{notice}</p>}
      {offline && !isGuest && <p className="df-live-note" role="status">Chat disconnected. Trying again…</p>}

      {tab === "vip" && <div className="df-tab-panel"><h2>VIP</h2><p>Play-money ranks are Bronze, Silver, Gold, and Diamond. They do not unlock cash.</p></div>}
      {tab === "race" && <div className="df-tab-panel"><h2>Race</h2><p>The daily leaderboard ranks play-coin profit.</p><Link to="/race">Open the race</Link></div>}
      {tab === "fairness" && <div className="df-tab-panel" id="fairness"><h2>Fairness</h2><p>Originals keep a small house edge. Upgrader win chance is stake divided by the target item, minus that edge. Results are simulated.</p></div>}
      {tab === "feedback" && (
        <form className="df-tab-panel" id="feedback" onSubmit={(event) => { event.preventDefault(); const body = sanitizeChat(feedback); if (!body) return; pushRow(me, "Feedback: " + body); setFeedback(""); setTab(""); }}>
          <h2>Feedback</h2>
          <textarea value={feedback} maxLength={240} onChange={(event) => setFeedback(event.target.value)} placeholder="Plain text only" />
          <button className="df-join" type="submit">Send</button>
        </form>
      )}

      {selected && (
        <section className="chat-profile" aria-label={selected.label}>
          <header>
            <h2>{maskName(selected.label)}</h2>
            <button type="button" className="ghost-btn" disabled={busy} onClick={() => setSelected(null)}>Close profile</button>
          </header>
          <div className="chat-profile-stats">
            {statsLoading ? <p>Loading player stats…</p> : playerStats ? (
              <>
                <div><small>Total wagered</small><strong>{formatUSD(playerStats.wageredCents)}</strong></div>
                <div><small>Won (profit)</small><strong className="pos">{formatUSD(playerStats.wonCents)}</strong></div>
                <div><small>Lost</small><strong className="neg">{formatUSD(playerStats.lostCents)}</strong></div>
                <div><small>Wins / losses</small><strong>{playerStats.wins} / {playerStats.losses}</strong></div>
                <div><small>Net result</small><strong>{formatUSD(playerStats.netCents)}</strong></div>
                <div><small>Recorded bets</small><strong>{playerStats.bets}</strong></div>
              </>
            ) : <p>No recorded stats available.</p>}
          </div>
          <p className="chat-stats-note">Based on reported community bets; records may be incomplete.</p>
          {board && selected.id === board.profile.id ? <p>This is your profile.</p> : (
            <form className="community-form" onSubmit={(event) => { event.preventDefault(); void transferTo(selected, amount); }}>
              <label htmlFor="chat-transfer">Amount in play coins</label>
              <input id="chat-transfer" inputMode="decimal" value={amount} maxLength={10} required onChange={(event) => setAmount(event.target.value)} disabled={busy || offline} />
              <button className="bet-btn" type="submit" disabled={busy || offline || !walletReady}>Send coins</button>
            </form>
          )}
          <p className="chat-stats-note">Send from your normal Play USD balance, including your game winnings and Rain rewards. No separate chat currency.</p>
        </section>
      )}

      {!tab && (
        <div className="chat-thread df-thread" role="log" aria-label="Community messages" tabIndex={0} ref={thread}>
          {rows.map((row) => {
            const rank: Rank = rankFor(row.name);
            return (
              <article key={row.id} className="df-msg">
                <span className="df-avatar" aria-hidden="true">{(row.name.replace(/[^a-z]/gi, "")[0] || "P").toUpperCase()}</span>
                <div>
                  <header>
                    <button type="button" className="df-name" onClick={() => {
                      if (row.serverId) setSelected({ id: row.serverId, label: row.name });
                      else setTipTarget({ name: row.name, serverId: row.serverId });
                    }}>{maskName(row.name)}</button>
                    <b data-rank={rank}>{rank}</b>
                    <time dateTime={new Date(row.at).toISOString()}>{new Date(row.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                    <button type="button" className="df-reply" aria-label={"Tip " + maskName(row.name)} onClick={() => setTipTarget({ name: row.name, serverId: row.serverId })}>↩</button>
                  </header>
                  <ChatBody text={row.body} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tipTarget && (
        <form className="df-tip" onSubmit={tipPerson}>
          <span>Tip {maskName(tipTarget.name)}</span>
          <input aria-label="Tip amount in coins" inputMode="decimal" value={tipValue} onChange={(event) => setTipValue(event.target.value)} />
          <button className="df-join" type="submit">Tip</button>
          <button type="button" onClick={() => setTipTarget(null)} aria-label="Cancel tip">✕</button>
        </form>
      )}
      {heartOpen && (
        <form className="df-tip" onSubmit={contributeRain}>
          <span>Rain tip</span>
          <input aria-label="Coins to add to the rain" inputMode="decimal" value={rainTip} onChange={(event) => setRainTip(event.target.value)} />
          <button className="df-join" type="submit">Add</button>
          <button type="button" onClick={() => setHeartOpen(false)} aria-label="Cancel rain tip">✕</button>
        </form>
      )}

      <form className="df-compose" onSubmit={send}>
        <label className="sr-only" htmlFor="chat-message">Message</label>
        <input id="chat-message" value={message} maxLength={240} autoComplete="off" placeholder={locked ? "Sign in to chat" : "Message"} disabled={locked || busy} onChange={(event) => setMessage(event.target.value)} />
        <button type="button" aria-label="Insert sticker" onClick={() => setMessage((value) => (value + " ✨").slice(0, 240))}>GIF</button>
        <button type="button" aria-label="Emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((open) => !open)}>☺</button>
        <button type="button" aria-label="Tip the rain pool" onClick={() => { if (locked) showSignIn(); else setHeartOpen((open) => !open); }}>♥</button>
      </form>
      {emojiOpen && (
        <div className="df-emoji" role="listbox" aria-label="Emoji">
          {EMOJI.map((item) => (
            <button key={item} type="button" onClick={() => { setMessage((value) => (value + item).slice(0, 240)); setEmojiOpen(false); }}>{item}</button>
          ))}
        </div>
      )}
      {isGuest && <p className="df-hint">Sign in to chat, tip, and join the rain pool.</p>}
    </section>
  );
}
