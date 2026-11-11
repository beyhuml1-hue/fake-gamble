import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";

type Player = { id: string; label: string };
type Message = { id: string; playerId: string; label: string; body: string; at: number };
type Board = {
  profile: Player & { cents: number };
  rain: { round: number; count: number; joined: 0 | 1; now: number; endsAt: number };
  messages: Message[];
  players: Player[];
};
type PublicStats={
 bets:number;wins:number;losses:number;wageredCents:number;wonCents:number;lostCents:number;netCents:number;
};

const URL = "/api/auth/community";

export function Community({ compact = false }: { compact?: boolean } = {}) {
  const { isGuest, canSignIn, showSignIn } = useAuth();
  const {balance,syncSocialWallet}=useWallet();
  const [board, setBoard] = useState<Board | null>(null);
  const [message, setMessage] = useState("");
  const [aiMessages, setAiMessages] = useState<{role:string;body:string;at:number}[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [selected, setSelected] = useState<Player | null>(null);
  const [playerStats,setPlayerStats]=useState<PublicStats|null>(null);
  const [statsLoading,setStatsLoading]=useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const request = useRef(0);
  const lastTransfer = useRef<{ id: string; recipient: string; cents: number } | null>(null);
  const thread = useRef<HTMLDivElement>(null);
  const follow = useRef(true);

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
    let active = true;
    fetch("/api/auth/ai-owner",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{
      if(active && data?.messages)setAiMessages(data.messages);
    }).catch(()=>{});
    return ()=>{active=false;};
  },[isGuest]);

  async function askAi(body:string) {
    if(aiBusy)return;
    setAiBusy(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/auth/ai-owner",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:body.replace(/^@ai\b\s*/i,"").trim()||body}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"AI couldn't respond.");
      const now=Date.now();
      setAiMessages(prev=>[...prev.slice(-28),{role:"user",body,at:now},{role:"assistant",body:result.reply,at:now+1}]);
      setMessage("");follow.current=true;
    }catch(err){setError(err instanceof Error?err.message:"AI is unavailable.");}
    finally{setAiBusy(false);}
  }

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
    const end = Date.now() + board.rain.endsAt - board.rain.now;
    const tick = () => setSeconds(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [board]);

  useEffect(() => {
    if (follow.current && thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [board?.messages]);

  useEffect(()=>{
    if(!selected){setPlayerStats(null);setStatsLoading(false);return;}
    let disposed=false;
    setPlayerStats(null);setStatsLoading(true);
    void fetch(URL+"?player="+encodeURIComponent(selected.id),{cache:"no-store"})
      .then(async response=>response.ok?response.json():null)
      .then(data=>{if(!disposed)setPlayerStats(data?.stats||null);})
      .catch(()=>{})
      .finally(()=>{if(!disposed)setStatsLoading(false);});
    return()=>{disposed=true;};
  },[selected?.id]);

  function mention(body:string){
    const parts=body.split(/(@Player [0-9A-F]{6}|@ai)/gi);
    return parts.map((fragment,index)=>{
      const person=board?.players?.find(p=>("@"+p.label).toLowerCase()===fragment.toLowerCase());
      return person?<button key={index} type="button" className="chat-inline-mention" onClick={()=>setSelected(person)}>{fragment}</button>:fragment;
    });
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

  function transfer() {
    if (!selected) return;
    const value = amount.trim();
    const cents = Math.round(Number(value) * 100);
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(value) || cents < 1 || cents > 100_000_000) {
      setError("Enter an amount from $0.01 to $1,000,000.00.");
      return;
    }
    if(cents>balance){setError("Your Play USD wallet doesn't have enough to send.");return;}
    if(cents>(board?.profile.cents||0)){setError("Only Rain and received-transfer credits are currently transferable. Earn more through Rain.");return;}
    const prior = lastTransfer.current;
    const id = prior?.recipient === selected.id && prior.cents === cents ? prior.id : crypto.randomUUID();
    lastTransfer.current = { id, recipient: selected.id, cents };
    void action({ action: "transfer", id, recipient: selected.id, cents }, () => {
      lastTransfer.current = null;
      syncSocialWallet();
      setNotice(`Sent ${formatUSD(cents)} to ${selected.label}. Their wallet will update and they'll receive a notification.`);
      setSelected(null);
      setAmount("");
    });
  }

  if (isGuest) return <section className="community-page">
    <h1>Chat</h1>
    <p>Log in to chat, send Play USD, and join Rain.</p>
    {canSignIn && <button type="button" className="bet-btn" onClick={showSignIn}>Log in</button>}
  </section>;

  if (!board) return <section className="community-page">
    <h1>Chat</h1>
    <p role="status">{offline ? "Chat is unavailable. Trying again…" : "Opening chat…"}</p>
  </section>;

  const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <section className={compact ? "community-page community-compact" : "community-page"}>
      <header className="community-heading">
        <h1>Chat</h1>
        
      </header>
      <section className="community-rain" aria-labelledby="rain-title">
        <div>
          <h2 id="rain-title">$10 Rain</h2>
          <p>{countdown} left · {board.rain.count} joined</p>
        </div>
        <button className="bet-btn" type="button" disabled={busy || offline || !!board.rain.joined || !seconds}
          onClick={() => void action({ action: "join", round: board.rain.round })}>
          {board.rain.joined ? "Joined" : seconds ? "Join Rain" : "Round closed"}
        </button>
        <p className="rain-details">Every 7 minutes, joined players split $10. Rewards go into your normal Play USD wallet automatically.</p>
      </section>

      {offline && <p role="status">Chat disconnected. Trying again…</p>}
      {error && <p className="neg" role="alert">{error}</p>}
      {notice && <p className="pos" role="status">{notice}</p>}

      {selected && (
        <section className="chat-profile" aria-label={selected.label}>
          <header>
            <h2>{selected.label}</h2>
            <button type="button" className="ghost-btn" disabled={busy} onClick={() => setSelected(null)}>Close profile</button>
          </header>
          <div className="chat-profile-stats">
            {statsLoading?<p>Loading player stats…</p>:playerStats?(
              <>
                <div><small>Total wagered</small><strong>{formatUSD(playerStats.wageredCents)}</strong></div>
                <div><small>Won (profit)</small><strong className="pos">{formatUSD(playerStats.wonCents)}</strong></div>
                <div><small>Lost</small><strong className="neg">{formatUSD(playerStats.lostCents)}</strong></div>
                <div><small>Wins / losses</small><strong>{playerStats.wins} / {playerStats.losses}</strong></div>
                <div><small>Net result</small><strong>{formatUSD(playerStats.netCents)}</strong></div>
                <div><small>Recorded bets</small><strong>{playerStats.bets}</strong></div>
              </>
            ):<p>No recorded stats available.</p>}
          </div>
          <p className="chat-stats-note">Based on reported community bets; records may be incomplete.</p>
          {selected.id === board.profile.id ? <p>This is your profile.</p> : (
            <form className="community-form" onSubmit={event => { event.preventDefault(); transfer(); }}>
              <label htmlFor="chat-transfer">Amount in Play USD</label>
              <input id="chat-transfer" inputMode="decimal" value={amount} maxLength={10} required
                onChange={event => setAmount(event.target.value)} disabled={busy || offline} />
              <button className="bet-btn" type="submit" disabled={busy || offline}>Send Play USD</button>
            </form>
          )}
          <p className="chat-stats-note">Transfers use your main Play USD wallet. Only Rain and received-transfer credits can currently be transferred.</p>
        </section>
      )}

      <div className="chat-thread" role="log" aria-label="Community messages" tabIndex={0} ref={thread}
        onScroll={event => {
          const box = event.currentTarget;
          follow.current = box.scrollHeight - box.scrollTop - box.clientHeight < 32;
        }}>
        {board.messages.length ? board.messages.map(row => (
          <article key={row.id} className="chat-message">
            <button type="button" className="chat-player" disabled={busy} onClick={() => {
              setSelected({ id: row.playerId, label: row.label });
              setAmount("");
            }}>{row.label}</button>
            <time dateTime={new Date(row.at).toISOString()}>{new Date(row.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
            <p>{mention(row.body)}</p>
          </article>
        )) : <p>No messages yet.</p>}
        {aiMessages.slice(-20).map((row,i)=><article key={"ai-"+row.at+"-"+i} className={"chat-message ai-"+row.role}>
          <strong className="chat-player">{row.role==="assistant"?"✦ BlockBet AI":"You → @ai"}</strong>
          <time dateTime={new Date(row.at).toISOString()}>{new Date(row.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</time>
          <p>{row.body}</p>
        </article>)}
      </div>
      <form className="community-form chat-compose" onSubmit={event => {
        event.preventDefault();
        if (/^@ai(?:\s|$)/i.test(message.trim())){void askAi(message.trim());return;}
        if (message.trim()) void action({ action: "message", body: message.trim() }, () => {
          follow.current = true;
          setMessage("");
        });
      }}>
        <label htmlFor="chat-message">Message</label>
        <div className="chat-mention-input">
          <input id="chat-message" value={message} maxLength={240} autoComplete="off" placeholder="Message… try @ai or @player"
            onChange={event => {setMessage(event.target.value);setMentionOpen(/@[^\s]*$/.test(event.target.value));}} disabled={busy || aiBusy || offline} />
          {mentionOpen&&<div className="chat-mentions" role="listbox" aria-label="Mention players">
            {["ai",...Array.from(new Set((board.players||[]).map(m=>m.label))).slice(0,25)]
              .filter(name=>name.toLowerCase().includes((message.match(/@([^\s]*)$/)?.[1]||"").toLowerCase()))
              .map(name=><button type="button" key={name} onClick={()=>{setMessage(v=>v.replace(/@[^\s]*$/,"@"+name+" "));setMentionOpen(false);}}>@{name}</button>)}
          </div>}
        </div>
        <button className="bet-btn" type="submit" disabled={busy || aiBusy || offline || !message.trim()}>{aiBusy?"AI thinking…":"Send"}</button>
      </form>
    </section>
  );
}
