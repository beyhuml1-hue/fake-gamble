import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";
import type { ShellContext } from "../components/AppShell";
import { dsmp } from "../components/DonutCashier";
import { formatAmount } from "../lib/money";
import { useWallet } from "../state/wallet";

type Transaction = { id: string; kind: "deposit" | "withdrawal" | "link"; amount: number; at: number; status: string };
const tabs = [
  ["deposit", "Deposits"], ["withdrawal", "Withdrawals"], ["link", "Verifications"], ["game", "Games"],
] as const;

export function Transactions() {
  const { isGuest, canSignIn, showSignIn } = useAuth();
  const { history } = useWallet();
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("deposit");
  const [transactions, setTransactions] = useState<Transaction[]>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isGuest) return;
    const controller = new AbortController();
    fetch("/api/auth/donut-cashier?view=transactions", { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Cashier unavailable");
        const data = await response.json() as { transactions: Transaction[] };
        setTransactions(data.transactions);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [isGuest]);

  const rows = tab === "game" ? history.map(game => ({
    id: game.id, at: game.at, label: game.game, amount: formatAmount(game.wager) + " Play USD",
    status: game.payout > game.wager ? "Won" : game.payout === game.wager ? "Push" : "Lost",
  })) : (isGuest ? [] : transactions ?? []).filter(row => row.kind === tab).map(row => ({
    id: row.id, at: row.at, label: row.id, amount: dsmp(row.amount), status: row.status,
  }));
  const empty = tab === "game" ? "No games played yet." : isGuest ? "Sign in to see your in-game transactions."
    : error ? "DonutSMP transaction history is unavailable." : !transactions ? "Loading transactions…" : "No transactions yet.";

  return <section className="account-page">
    <h1>Transactions</h1>
    <div className="account-switch" role="group" aria-label="Transaction category">
      {tabs.map(([id, label]) => <button key={id} type="button" aria-pressed={id === tab} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    <div className="account-table">
      <table>
        <thead><tr><th>Date</th><th>{tab === "game" ? "Game" : "Reference"}</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td>{new Date(row.at).toLocaleString()}</td><td>{row.label}</td><td>{row.amount}</td><td>{row.status}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <div className="account-empty" role="status">{empty}
        {tab !== "game" && isGuest && canSignIn && <button type="button" className="ghost-btn" onClick={showSignIn}>Sign in</button>}
      </div>}
    </div>
  </section>;
}

export function Rewards() {
  const { isGuest, canSignIn, showSignUp } = useAuth();
  const { balance, walletReady, history } = useWallet();
  const { donutCashier } = useOutletContext<ShellContext>();
  return <section className="account-page">
    <h1>Rewards</h1>
    <div className="reward-banner">
      <h2>Welcome credit</h2>
      <strong>1,000,000 Play USD</strong>
      <p>New signed-in Play USD wallets receive this simulated credit automatically.</p>
      {isGuest && canSignIn && <button type="button" className="bet-btn" onClick={showSignUp}>Create an account</button>}
    </div>
    <div className="account-metrics">
      <div><small>Play USD balance</small><strong>{walletReady ? formatAmount(balance) : "Syncing…"}</strong></div>
      <div><small>Games recorded here</small><strong>{history.length}</strong></div>
      <div><small>DonutSMP account</small><strong>{donutCashier.data?.wallet?.player ?? "Unlinked"}</strong></div>
    </div>
    <Link to="/stats">View play statistics</Link>
  </section>;
}
