import { useState } from "react";
import { cardMatches, digits } from "../lib/card";
import { formatAmount, formatUSD } from "../lib/money";
import { sound } from "../lib/sound";
import { useWallet } from "../state/wallet";

function formatPan(raw: string) {
  return digits(raw)
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ")
    .trim();
}

function formatExp(raw: string) {
  const d = digits(raw).slice(0, 4);
  if (d.length < 3) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export function Cashier({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { balance, cardBalance, ledger, depositFromCard, withdrawToCard } = useWallet();
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [holder, setHolder] = useState("");
  const [amount, setAmount] = useState("25.00");
  const [note, setNote] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ kind: "deposit" | "withdrawal"; cents: number; ref: string } | null>(null);

  if (!open) return null;

  const cents = Math.round(Number(amount) * 100);
  const amountLabel = Number.isFinite(cents) ? (cents / 100).toFixed(2) : "0.00";
  const last4 = digits(number).slice(-4);
  const shownPan = number || "•••• •••• •••• ••••";

  const submit = () => {
    if (busy) return;
    if (!cardMatches(number, exp, cvc)) {
      setBad(true);
      setNote("Card declined. Check the number, expiry, and CVC.");
      sound.lose();
      return;
    }
    if (!Number.isFinite(cents)) {
      setBad(true);
      setNote("Enter an amount.");
      return;
    }
    setBusy(true);
    setBad(false);
    setNote(tab === "deposit" ? "Authorizing…" : "Sending…");
    window.setTimeout(() => {
      const err = tab === "deposit" ? depositFromCard(cents) : withdrawToCard(cents);
      setBusy(false);
      if (err) {
        setBad(true);
        setNote(err);
        return;
      }
      setNote("");
      setReceipt({ kind: tab === "deposit" ? "deposit" : "withdrawal", cents, ref: "" });
    }, 900);
  };

  const close = () => {
    setReceipt(null);
    setNote("");
    setBad(false);
    onClose();
  };

  const latest = ledger[0];
  const shownReceipt = receipt && latest && latest.kind === receipt.kind ? { ...receipt, ref: latest.ref } : receipt;

  return (
    <div className="modal-back" role="presentation" onClick={close}>
      <div className="modal wallet-modal" role="dialog" aria-labelledby="cashier-title" onClick={(event) => event.stopPropagation()}>
        <div className="cashier-head">
          <div>
            <h2 id="cashier-title">Wallet</h2>
            <p className="hint">Balance {formatUSD(balance)}</p>
          </div>
          <button type="button" className="text-btn" onClick={close}>
            Close
          </button>
        </div>

        {shownReceipt ? (
          <div className="receipt">
            <span className="receipt-mark">$</span>
            <h3>{shownReceipt.kind === "deposit" ? "Deposit completed" : "Withdrawal completed"}</h3>
            <strong>{formatUSD(shownReceipt.cents)}</strong>
            <p>{shownReceipt.kind === "deposit" ? "Added to your balance." : "Sent back to the card."}</p>
            {shownReceipt.ref ? <small>Reference {shownReceipt.ref}</small> : null}
            <button className="bet-btn" type="button" onClick={() => setReceipt(null)}>
              Done
            </button>
          </div>
        ) : (
          <div className="wallet-layout">
            <div>
              <div className="plastic">
                <div className="plastic-top">
                  <span className="chip" />
                  <strong>DEBIT</strong>
                </div>
                <p className="pan">{shownPan}</p>
                <div className="plastic-foot">
                  <span>{holder || "Cardholder"}</span>
                  <span>{exp || "MM/YY"}</span>
                </div>
                <p className="plastic-funds">{last4 ? `•••• ${last4}` : "Available"} {formatUSD(cardBalance)}</p>
              </div>
              <div className="wallet-split">
                <p>
                  <span>Balance</span>
                  <strong>{formatAmount(balance)}</strong>
                </p>
                <p>
                  <span>Card</span>
                  <strong>{formatAmount(cardBalance)}</strong>
                </p>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <div className="select">
                <button type="button" className={tab === "deposit" ? "on" : ""} onClick={() => setTab("deposit")}>
                  Deposit
                </button>
                <button type="button" className={tab === "withdraw" ? "on" : ""} onClick={() => setTab("withdraw")}>
                  Withdraw
                </button>
              </div>
              <label className="field">
                <span className="field-label">Amount</span>
                <span className="amount">
                  <span className="amount-prefix">$</span>
                  <input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} />
                </span>
              </label>
              <div className="quick-amounts">
                {["25.00", "50.00", "100.00", "250.00"].map((value) => (
                  <button key={value} type="button" onClick={() => setAmount(value)}>
                    ${Number(value).toFixed(0)}
                  </button>
                ))}
              </div>
              <label className="field">
                <span className="field-label">Card number</span>
                <span className="amount">
                  <input value={number} inputMode="numeric" autoComplete="off" placeholder="Card number" onChange={(event) => setNumber(formatPan(event.target.value))} />
                </span>
              </label>
              <div className="cashier-row">
                <label className="field">
                  <span className="field-label">Expiry</span>
                  <span className="amount">
                    <input value={exp} inputMode="numeric" autoComplete="off" placeholder="MM/YY" onChange={(event) => setExp(formatExp(event.target.value))} />
                  </span>
                </label>
                <label className="field">
                  <span className="field-label">CVC</span>
                  <span className="amount">
                    <input value={cvc} inputMode="numeric" autoComplete="off" placeholder="CVC" maxLength={4} onChange={(event) => setCvc(digits(event.target.value).slice(0, 4))} />
                  </span>
                </label>
              </div>
              <label className="field">
                <span className="field-label">Name on card</span>
                <span className="amount">
                  <input value={holder} autoComplete="off" placeholder="Name on card" onChange={(event) => setHolder(event.target.value)} />
                </span>
              </label>
              {note ? <p className={bad ? "form-error" : "hint"}>{note}</p> : null}
              <button className="bet-btn" type="submit" disabled={busy}>
                {busy ? "Processing…" : tab === "deposit" ? `Deposit $${amountLabel}` : `Withdraw $${amountLabel}`}
              </button>
            </form>
          </div>
        )}

        <section className="ledger">
          <h3>Transactions</h3>
          {ledger.length === 0 ? (
            <p className="hint">Deposits and withdrawals show up here.</p>
          ) : (
            <ul>
              {ledger.map((row) => (
                <li key={row.id}>
                  <span>
                    <b>{row.kind === "deposit" ? "Deposit" : "Withdrawal"}</b>
                    <small>{row.ref}</small>
                  </span>
                  <strong className={row.kind === "deposit" ? "pos" : ""}>
                    {row.kind === "deposit" ? "+" : "−"}
                    {formatUSD(row.cents)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
