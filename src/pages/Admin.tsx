import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../components/AuthProvider";
import { formatUSD } from "../lib/money";

type Account = { email: string; label: string | null; banned: 0 | 1; balanceCents: number | null; walletReady: 0 | 1; lastAdjustment: number | null };
type Economy = { wallets: number; circulationCents: number; wageredCents: number; treasuryUnits: number; strength: number };
type AdminAction = "balance" | "add" | "subtract" | "ban" | "unban" | "supply" | "strength";

async function adminRequest(params?: { action: AdminAction | "unlock" | "lock"; email?: string; cents?: number; password?: string; strength?: number }, query?: string) {
  const url = "/api/auth/admin" + (!params ? "?view=session" : "");
  const response = await fetch(query !== undefined ? "/api/auth/admin?" + new URLSearchParams({ q: query }) : url, {
    method: params ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    ...(params ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Admin request failed.");
  return result as { ok?: boolean; unlocked?: boolean; account?: Account; accounts?: Account[]; economy?: Economy };
}

async function readEconomy() {
  const response = await fetch("/api/auth/admin?view=economy", { credentials: "same-origin", cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not read the economy.");
  return result.economy as Economy;
}

export function Admin() {
  const { isGuest, showSignIn } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmBan, setConfirmBan] = useState(false);
  const [economy, setEconomy] = useState<Economy | null>(null);
  const [supply, setSupply] = useState("");
  const [strength, setStrength] = useState("");

  useEffect(() => {
    let alive = true;
    void adminRequest().then(() => {
      if (!alive) return;
      setUnlocked(true);
      return Promise.all([adminRequest(undefined, ""), readEconomy()]).then(([data, next]) => {
        if (!alive) return;
        setAccounts(data.accounts || []);
        setEconomy(next);
      });
    }).catch(() => { if (alive) setUnlocked(false); }).finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);

  const account = accounts.find(item => item.email === selected) || null;
  const clearMessages = () => { setError(""); setNotice(""); };

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); clearMessages();
    try {
      await adminRequest({ action: "unlock", password });
      setPassword("");
      const [data, next] = await Promise.all([adminRequest(undefined, ""), readEconomy()]);
      setAccounts(data.accounts || []);
      setEconomy(next);
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect password.");
    } finally { setBusy(false); }
  }

  async function findPlayers(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setBusy(true); clearMessages();
    try {
      const data = await adminRequest(undefined, search.trim());
      setAccounts(data.accounts || []);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load players.");
    } finally { setBusy(false); }
  }

  async function action(type: AdminAction, cents?: number) {
    if (!account || busy) return;
    setBusy(true); clearMessages(); setConfirmBan(false);
    try {
      const data = await adminRequest({ action: type, email: account.email, cents });
      if (data.account) {
        setAccounts(prev => prev.map(row => row.email === account.email ? data.account! : row));
        setAmount("");
      }
      setNotice(type === "ban" ? "Account banned and signed out." :
        type === "unban" ? "Account unbanned." : "Live Play USD balance updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account update failed.");
    } finally { setBusy(false); }
  }

  function updateBalance(event: FormEvent<HTMLFormElement>, type: AdminAction) {
    event.preventDefault();
    const trimmed = amount.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      setError("Use an amount such as 1000000 or 1000000.50.");
      return;
    }
    const cents = Math.round(Number(trimmed) * 100);
    if (!Number.isSafeInteger(cents) || cents < 0) {
      setError("Amount is outside the supported Play USD range.");
      return;
    }
    void action(type, cents);
  }

  if (isGuest) return <section className="admin-page">
    <h1>Owner controls</h1><p>Log in to your PlayBlockBet account before unlocking the admin panel.</p>
    <button className="bet-btn" type="button" onClick={showSignIn}>Log in</button>
  </section>;

  if (checking) return <section className="admin-page"><h1>Owner controls</h1><p>Checking admin access…</p></section>;

  if (!unlocked) return <section className="admin-page">
    <h1>Owner controls</h1>
    <p>Enter your admin password to edit Play USD balances and manage accounts.</p>
    <form className="admin-form" onSubmit={unlock}>
      <label htmlFor="admin-password">Admin password</label>
      <input id="admin-password" type="password" autoComplete="off" minLength={6} maxLength={128}
        value={password} onChange={event => setPassword(event.target.value)} disabled={busy} required />
      <button className="bet-btn" type="submit" disabled={busy}>{busy ? "Checking…" : "Unlock admin"}</button>
    </form>
    {error && <p className="neg" role="alert">{error}</p>}
  </section>;

  return <section className="admin-page">
    <div className="admin-header">
      <div><h1>Owner controls</h1><p>Live account balances and player management</p></div>
      <button className="ghost-btn" type="button" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await adminRequest({ action: "lock" }); setUnlocked(false); setAccounts([]); setSelected(null); }
        catch (err) { setError(err instanceof Error ? err.message : "Could not lock admin."); }
        finally { setBusy(false); }
      }}>Lock admin</button>
    </div>
    {economy && <article className="admin-account">
      <h2>Economy</h2>
      <div className="admin-economy">
        <div><span>Money in the world</span><strong>{formatUSD(economy.circulationCents)}</strong></div>
        <div><span>Strength</span><strong>{economy.strength} / 100</strong></div>
        <div><span>Wagered</span><strong>{formatUSD(economy.wageredCents)}</strong></div>
      </div>
      <p>{economy.wallets} signed-in wallet{economy.wallets === 1 ? "" : "s"}. Strength 50 means those wallets average $1,000.00. House units waiting: {economy.treasuryUnits}.</p>
      <form className="admin-form" onSubmit={event => {
        event.preventDefault();
        const trimmed = supply.trim();
        if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) { setError("Use a total such as 1000000 or 1000000.50."); return; }
        const cents = Math.round(Number(trimmed) * 100);
        if (!Number.isSafeInteger(cents) || cents < 0) { setError("That total is outside the Play USD range."); return; }
        setBusy(true); clearMessages();
        void adminRequest({ action: "supply", cents }).then(data => {
          if (data.economy) setEconomy(data.economy);
          setSupply("");
          setNotice("Money in the world was scaled to that total.");
          return adminRequest(undefined, "");
        }).then(data => { if (data?.accounts) setAccounts(data.accounts); }).catch(err => {
          setError(err instanceof Error ? err.message : "Could not change the money supply.");
        }).finally(() => setBusy(false));
      }}>
        <label htmlFor="admin-supply">Set all money in the world (Play USD)</label>
        <input id="admin-supply" inputMode="decimal" placeholder="e.g. 250000" maxLength={18}
          value={supply} onChange={event => setSupply(event.target.value)} disabled={busy} required />
        <button className="bet-btn" type="submit" disabled={busy}>Scale every wallet</button>
      </form>
      <form className="admin-form" onSubmit={event => {
        event.preventDefault();
        const next = Number(strength);
        if (!Number.isInteger(next) || next < 0 || next > 100) { setError("Strength is a whole number from 0 to 100."); return; }
        setBusy(true); clearMessages();
        void adminRequest({ action: "strength", strength: next }).then(data => {
          if (data.economy) setEconomy(data.economy);
          setStrength("");
          setNotice("Economy strength updated.");
          return adminRequest(undefined, "");
        }).then(data => { if (data?.accounts) setAccounts(data.accounts); }).catch(err => {
          setError(err instanceof Error ? err.message : "Could not change the strength.");
        }).finally(() => setBusy(false));
      }}>
        <label htmlFor="admin-strength">Set strength from 0 to 100</label>
        <input id="admin-strength" inputMode="numeric" placeholder="50" maxLength={3}
          value={strength} onChange={event => setStrength(event.target.value)} disabled={busy} required />
        <button className="bet-btn" type="submit" disabled={busy}>Set strength</button>
      </form>
    </article>}
    <form className="admin-form" onSubmit={event => void findPlayers(event)}>
      <label htmlFor="admin-search">Find players by name or email</label>
      <input id="admin-search" type="search" placeholder="Search players…" value={search}
        onChange={event => setSearch(event.target.value)} disabled={busy} />
      <button className="bet-btn" type="submit" disabled={busy}>Search</button>
    </form>
    <div className="admin-player-list">
      <p>{accounts.length} player{accounts.length === 1 ? "" : "s"} shown</p>
      {accounts.map(player => <button key={player.email} type="button"
        className={"admin-player" + (selected === player.email ? " selected" : "")}
        onClick={() => { setSelected(player.email); setAmount(""); clearMessages(); setConfirmBan(false); }}>
        <span><strong>{player.label || player.email.split("@")[0]}</strong><small>{player.email}</small></span>
        <span><strong>{formatUSD(player.balanceCents ?? 0)}</strong><small>{player.banned ? "Banned" : "Active"}</small></span>
      </button>)}
      {!accounts.length && <p>No accounts found.</p>}
    </div>
    {account && <article className="admin-account">
      <h2>{account.label || account.email}</h2>
      <p>{account.email} · {account.banned ? "Banned" : "Active"}</p>
      <p>Current main wallet balance: <strong>{formatUSD(account.balanceCents ?? 0)}</strong></p>
      <form className="admin-form" onSubmit={event => updateBalance(event, "balance")}>
        <label htmlFor="admin-amount">Play USD amount (not cents)</label>
        <input id="admin-amount" inputMode="decimal" placeholder="e.g. 1000000000000"
          maxLength={18} required value={amount} onChange={event => setAmount(event.target.value)} disabled={busy}/>
        <div className="admin-actions">
          <button type="submit" className="bet-btn" disabled={busy}>Set balance</button>
          <button type="button" className="ghost-btn" disabled={busy} onClick={event => {
            const form = event.currentTarget.closest("form");
            if (form) updateBalance({ preventDefault() {} } as FormEvent<HTMLFormElement>, "add");
          }}>Add amount</button>
          <button type="button" className="ghost-btn" disabled={busy} onClick={event => {
            const form = event.currentTarget.closest("form");
            if (form) updateBalance({ preventDefault() {} } as FormEvent<HTMLFormElement>, "subtract");
          }}>Remove amount</button>
        </div>
      </form>
      <p>Changes update the player's server wallet immediately and are synchronized to their account.</p>
      {account.banned ? <button className="ghost-btn" type="button" disabled={busy}
        onClick={() => void action("unban")}>Unban account</button> :
        confirmBan ? <div className="admin-actions">
          <button type="button" className="ghost-btn" disabled={busy} onClick={() => void action("ban")}>Confirm ban</button>
          <button type="button" className="ghost-btn" onClick={() => setConfirmBan(false)}>Cancel</button>
        </div> :
        <button className="ghost-btn" type="button" disabled={busy} onClick={() => setConfirmBan(true)}>Ban account</button>}
    </article>}
    {error && <p className="neg" role="alert">{error}</p>}
    {notice && <p className="pos" role="status">{notice}</p>}
  </section>;
}
