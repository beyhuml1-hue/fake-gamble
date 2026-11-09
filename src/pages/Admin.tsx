import { useState, type FormEvent } from "react";
import { useAuth } from "../components/AuthProvider";
import { formatUSD } from "../lib/money";

type Account = { email: string; banned: 0 | 1; balanceCents: number | null };
type Action = "balance" | "ban" | "unban";

async function accountRequest(email: string, action?: Action, cents?: number): Promise<Account> {
  const url = "/api/auth/admin";
  const response = await fetch(action ? url : url + "?" + new URLSearchParams({ email }), {
    method: action ? "POST" : "GET",
    cache: "no-store",
    ...(action && { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, action, cents }) }),
  });
  const data = await response.json();
  if (!response.ok || !data.account) throw new Error(data.error || "Couldn't load the account.");
  return data.account;
}

export function Admin() {
  const { isAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmBan, setConfirmBan] = useState(false);

  if (!isAdmin) return <section className="admin-page"><h1>Owner access required</h1><p>Log in with the owner account to manage players.</p></section>;

  async function submit(action?: Action, cents?: number) {
    const target = action ? account?.email : email.trim();
    if (!target || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setConfirmBan(false);
    if (!action) setAccount(null);
    try {
      const result = await accountRequest(target, action, cents);
      setAccount(result);
      setAmount(result.balanceCents === null ? "" : (result.balanceCents / 100).toFixed(2));
      if (action) setNotice(action === "balance" ? "Balance adjustment saved." : result.banned ? "Account banned." : "Account enabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account request failed.");
    } finally {
      setBusy(false);
    }
  }

  function saveBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      setError("Enter dollars and up to two decimal places.");
      return;
    }
    void submit("balance", Math.round(Number(amount) * 100));
  }

  return (
    <section className="admin-page">
      <h1>Manage accounts</h1>
      <form className="admin-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label htmlFor="admin-email">Player email</label>
        <input id="admin-email" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
        <button className="bet-btn" type="submit" disabled={busy}>Find account</button>
      </form>
      {account && (
        <article className="admin-account">
          <h2>{account.email}</h2>
          <p>{account.banned ? "Banned" : "Active"} · {account.balanceCents === null ? "No balance adjustment" : "Last adjustment " + formatUSD(account.balanceCents)}</p>
          <form className="admin-form" onSubmit={saveBalance}>
            <label htmlFor="admin-amount">New Play USD balance</label>
            <input id="admin-amount" inputMode="decimal" required maxLength={10} value={amount} onChange={event => setAmount(event.target.value)} disabled={busy} />
            <button className="bet-btn" type="submit" disabled={busy}>Set balance</button>
          </form>
          <p>The adjustment applies when the player signs in or their session refreshes. Play activity stays on their device.</p>
          {account.banned ? (
            <button className="ghost-btn" type="button" disabled={busy} onClick={() => void submit("unban")}>Unban account</button>
          ) : confirmBan ? (
            <div className="admin-actions">
              <button className="ghost-btn" type="button" onClick={() => void submit("ban")}>Confirm ban and revoke sessions</button>
              <button className="ghost-btn" type="button" onClick={() => setConfirmBan(false)}>Cancel</button>
            </div>
          ) : (
            <button className="ghost-btn" type="button" disabled={busy} onClick={() => setConfirmBan(true)}>Ban account</button>
          )}
        </article>
      )}
      {error && <p className="neg" role="alert">{error}</p>}
      {notice && <p className="pos" role="status">{notice}</p>}
    </section>
  );
}
