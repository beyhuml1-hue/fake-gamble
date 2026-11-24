import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import "./wallet-plain.css";
import "./donut-cashier.css";

export type DonutState = {
  wallet: { player: string; balance: number } | null;
  intent: { id: string; kind: "link" | "deposit"; player: string; amount: number; status: string } | null;
  withdrawal: { id: string; amount: number; status: string } | null;
  cashier: string;
  minimumDeposit: number;
  configured: boolean;
  enabled: boolean;
  coinflip: boolean;
};

const whole = new Intl.NumberFormat("en-US");
export const dsmp = (amount: number) => whole.format(amount) + " DSMP";

export function useDonutCashier(signedIn: boolean) {
  const [data, setData] = useState<DonutState>();
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    if (!signedIn) return;
    const request = ++revision.current;
    try {
      const response = await fetch("/api/auth/donut-cashier", { cache: "no-store" });
      if (request !== revision.current) return;
      if (response.ok) {
        const next = await response.json() as DonutState;
        if (request === revision.current) setData(next);
      } else if (response.status === 401 || response.status === 503) setData(undefined);
    } catch {
      if (request === revision.current) setData(previous => previous && { ...previous, enabled: false, coinflip: false });
    }
  }, [signedIn]);
  useEffect(() => {
    if (!signedIn) {
      setData(undefined);
      return;
    }
    void refresh();
    const polling = window.setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    window.addEventListener("focus", refresh);
    return () => {
      revision.current++;
      window.clearInterval(polling);
      window.removeEventListener("focus", refresh);
    };
  }, [signedIn, refresh]);
  return { data: signedIn ? data : undefined, refresh, accept: (next: DonutState) => {
    revision.current++;
    setData(next);
  } };
}

type CashierProps = {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  onSignIn: () => void;
  cashier: ReturnType<typeof useDonutCashier>;
};

export function DonutCashier({ open, onClose, cashier, signedIn, onSignIn }: CashierProps) {
  const { data, refresh, accept } = cashier;
  const [amount, setAmount] = useState("");
  const [player, setPlayer] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open, data?.configured]);

  async function submit(action: "link" | "deposit" | "withdraw", event?: FormEvent) {
    event?.preventDefault();
    if (busy || !data?.enabled) return;
    setBusy(true);
    setNote("");
    try {
      const response = await fetch("/api/auth/donut-cashier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: crypto.randomUUID(), amount: Number(amount), player: player.trim() }),
      });
      const updated = await response.json() as DonutState & { error?: string };
      if (!response.ok) setNote(updated.error || "Cashier request failed.");
      else {
        accept(updated);
        if (action !== "link") setAmount("");
      }
    } catch {
      setNote("Connection interrupted. Check the status before sending another payment.");
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  const { wallet, intent, withdrawal } = data ?? {};
  const online = Boolean(data?.enabled);
  const pending = intent?.status === "open";
  const pay = pending && data?.enabled ? `/pay ${data.cashier} ${intent.amount}` : "";
  const withdrawalPending = ["queued", "claimed", "review"].includes(withdrawal?.status || "");
  const validAmount = /^\d+$/.test(amount) && Number(amount) >= 1 && Number(amount) <= 100_000_000;
  const validDeposit = validAmount && data?.minimumDeposit != null && Number(amount) >= data.minimumDeposit;
  const withdrawStatus: Record<string, string> = {
    queued: "Queued for the cashier.", claimed: "Picked up by the cashier. Awaiting payment confirmation.",
    confirmed: "Paid to your linked account.", cancelled: "Cancelled before sending. Balance restored.",
    review: "Payment confirmation is unclear. The amount remains reserved for review.",
  };

  return (
    <dialog ref={dialog} className="wallet-fold donut-cashier" aria-labelledby="donut-cashier-title"
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <header className="wallet-fold-head">
        <div className="wallet-fold-id"><div>
          <p className="donut-kicker">{wallet ? wallet.player : "DonutSMP"}</p>
          <strong id="donut-cashier-title">{wallet ? dsmp(wallet.balance) : "DSMP Wallet"}</strong>
        </div></div>
        <button type="button" className="wallet-fold-x" aria-label="Close cashier" onClick={onClose}>×</button>
      </header>
      <div className="wallet-fold-body">
        {!signedIn && <button type="button" className="wallet-btn" onClick={onSignIn}>Sign in to BlockBet</button>}
        {!online && <p role="status">Cashier offline. Deposits and withdrawals are paused.</p>}
        {signedIn && !wallet && !pending && <form onSubmit={event => void submit("link", event)}>
          <h2>Sign in with Minecraft</h2>
          <label>In-game name
            <input value={player} maxLength={17} autoComplete="off" pattern="[.]?[A-Za-z0-9_]{1,16}"
              placeholder="Your IGN" onChange={event => setPlayer(event.target.value)} required />
          </label>
          <p>Use a leading dot for Bedrock, like <b>.Player</b>. For Java, enter <b>Player</b>.</p>
          <button className="wallet-btn" disabled={!online || busy}>Accept</button>
        </form>}
        {<div className="donut-actions">
          <label>Amount in DSMP
            <input value={amount} inputMode="numeric" maxLength={9} placeholder="Enter an amount"
              onChange={event => setAmount(event.target.value)} />
          </label>
          <div>
            <button className="wallet-btn" disabled={!wallet || !online || busy || !validDeposit || pending || intent?.status === "review"}
              onClick={() => void submit("deposit")}>Deposit</button>
            <button className="wallet-btn" disabled={!wallet || !online || busy || !validAmount || withdrawalPending || Number(amount) > (wallet?.balance ?? 0)}
              onClick={() => void submit("withdraw")}>Withdraw</button>
          </div>
          {data?.minimumDeposit != null && <p>Minimum deposit: {whole.format(data.minimumDeposit)} coins.</p>}
        </div>}
        {pay && intent && <div className="donut-instruction">
          <p>Send this exact payment in-game from <strong>{intent.player}</strong>{intent.kind === "link" ? " to verify your name." : " to fund your balance."}</p>
          <code>{pay}</code>
          <button type="button" className="ghost-btn" onClick={() => {
            void navigator.clipboard.writeText(pay).then(() => setNote("Command copied."), () => setNote("Select and copy the command above."));
          }}>Copy</button>
        </div>}
        {intent?.status === "review" && <p role="status">The server shortened the amount shown. The cashier needs to verify the exact payment.</p>}
        {intent?.status === "expired" && <p role="status">The payment request expired. If you already paid, check the payment with the cashier before sending it again.</p>}
        {intent?.status === "credited" && <p role="status">{intent.kind === "link" ? "Account verified. The payment was credited." : "Deposit confirmed."}</p>}
        {withdrawal && <p role="status">Withdrawal · {dsmp(withdrawal.amount)}. {withdrawStatus[withdrawal.status]}</p>}
        {note && <p className="wallet-fold-note" role="status">{note}</p>}
      </div>
    </dialog>
  );
}
