import { useState } from "react";
import { formatUSD, START_CENTS } from "../lib/money";
import { useWallet } from "../state/wallet";
import "./wallet-plain.css";

/** Free play-money refill only. Never asks for card, crypto, or payment details. */
export function Cashier({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { balance, walletReady, credit } = useWallet();
  const [claimed, setClaimed] = useState(0);
  const [error, setError] = useState("");

  if (!open) return null;
  const missing = Math.max(0, START_CENTS - balance);
  const close = () => { setClaimed(0); setError(""); onClose(); };
  const claim = () => {
    if (!walletReady) { setError("Your play-money balance is syncing."); return; }
    if (missing === 0) { setError("Your balance is already at least " + formatUSD(START_CENTS) + "."); return; }
    const added = credit(missing);
    if (!added) { setError("Unable to add play money."); return; }
    setClaimed(added);
    setError("");
  };

  return <div className="modal-back" role="presentation" onClick={close}>
    <div className="modal wallet-modal wallet-plain" role="dialog" aria-modal="true"
      aria-labelledby="cashier-title" onClick={event => event.stopPropagation()}>
      <header className="cashier-head">
        <div><h2 id="cashier-title">Play-money wallet</h2>
          <p className="hint">Available balance <strong>{formatUSD(balance)}</strong></p></div>
        <button className="text-btn" type="button" onClick={close}>Close</button>
      </header>
      <div className="wallet-plain-intro">
        <strong>Free play credits</strong>
        <span>Top your balance up to {formatUSD(START_CENTS)}. No card, deposit, withdrawal, or crypto wallet needed.</span>
      </div>
      {claimed > 0 && <div className="receipt" role="status">
        <span className="receipt-mark">✓</span>
        <h3>Play money added</h3><strong>{formatUSD(claimed)}</strong>
      </div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="bet-btn" type="button" onClick={claim} disabled={!walletReady || missing === 0}>
        {!walletReady ? "Syncing balance…" : missing > 0 ? "Claim " + formatUSD(missing) : "Balance topped up"}
      </button>
      <p className="wallet-plain-foot">Play money only - no real value.</p>
    </div>
  </div>;
}
