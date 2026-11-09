import { useEffect, useState } from "react";
import { formatMult, formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";

type LiveRow = {
  id: string;
  label: string;
  game: string;
  wager: number;
  payout: number;
  at: number;
};
type Feed = { bets?: LiveRow[]; error?: string; live?: boolean };

function validRow(row: LiveRow) {
  return row && typeof row.id === "string" && typeof row.label === "string" &&
    typeof row.game === "string" && typeof row.at === "number" &&
    Number.isFinite(row.wager) && Number.isFinite(row.payout);
}

export function BetsTable() {
  const { history } = useWallet();
  const [tab, setTab] = useState<"live" | "mine">("mine");
  const [bets, setBets] = useState<LiveRow[]>([]);
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (tab !== "live") return;
    let disposed = false;
    let pending = false;
    async function refresh() {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const response = await fetch("/api/auth/live-bets", {
          method:"GET", cache:"no-store", credentials:"same-origin"
        });
        if (!response.ok) throw new Error("Feed offline");
        const data = await response.json() as Feed;
        if (disposed) return;
        setBets(Array.isArray(data.bets) ? data.bets.filter(validRow).slice(0,30) : []);
        setStatus("online");
        setUpdatedAt(Date.now());
      } catch {
        if (!disposed) setStatus("offline");
      } finally {
        pending = false;
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    const onBet = () => void refresh();
    window.addEventListener("blockbet:bet", onBet);
    window.addEventListener("focus", onBet);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("blockbet:bet", onBet);
      window.removeEventListener("focus", onBet);
    };
  }, [tab]);

  const entries = tab === "live" ? bets.map(row => ({
    ...row, time: row.at
  })) : history.map(row => ({
    id:row.id, label:"You", game:row.game, wager:row.wager,
    payout:row.payout, time:row.at
  }));
  return (
    <section className="bets live-bets" id="live-bets">
      <div className="bets-head live-bets-heading">
        <div>
          <h2>Live Bets <span className={status === "online" ? "live-feed-dot online" : "live-feed-dot"} aria-label={status}/></h2>
          <p>Bets use Play USD. Community results come from players’ devices.</p>
        </div>
        <div className="live-bets-tabs" role="group" aria-label="Bet history view">
          <button type="button" className={tab==="live" ? "selected" : ""} onClick={()=>setTab("live")} aria-pressed={tab==="live"}>Community Bets</button>
          <button type="button" className={tab==="mine" ? "selected" : ""} onClick={()=>setTab("mine")} aria-pressed={tab==="mine"}>Your Bets</button>
        </div>
      </div>
      <div className="live-feed-meta">
        <span>{tab==="live" ? status==="online" ? "LIVE" : status==="offline" ? "FEED OFFLINE" : "CONNECTING…" : "THIS DEVICE"}</span>
        <span>{tab==="live" ? updatedAt ? "Refreshes every 5 seconds" : "Connecting to players…" : "Saved on this device"}</span>
      </div>
      <div className="bets-scroll">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Game</th>
              <th>Time</th>
              <th>Wager</th>
              <th>Multiplier</th>
              <th>Payout</th>
            </tr>
          </thead>
          <tbody>
            {entries.length===0 ? (
              <tr><td colSpan={6} className="empty-row">
                {tab==="mine" ? "Your settled bets will appear here."
                  : status==="offline" ? "Live feed unavailable. Your games still work."
                  : status==="loading" ? "Connecting to community bets…" :
                  "No community bets yet. Sign in and place a bet to be first."}
              </td></tr>
            ) : entries.map(row=>{
              const mult=row.wager>0 ? row.payout/row.wager : 0;
              const win=row.payout>row.wager;
              return <tr key={row.id}>
                <td className="live-bet-player"><span className="player-dot" />{row.label}</td>
                <td>{row.game}</td>
                <td>{new Date(row.time).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</td>
                <td>{formatUSD(row.wager)}</td>
                <td className={win?"pos":"neg"}>{formatMult(mult)}</td>
                <td className={win?"pos":row.payout===row.wager?"":"neg"}>{formatUSD(row.payout)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
