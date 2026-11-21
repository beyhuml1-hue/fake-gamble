import { Link } from "react-router-dom";
import { formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";
import "./wallet-plain.css";

export function Cashier({open,onClose}:{open:boolean;onClose:()=>void}) {
  const {balance} = useWallet();
  if (!open) return null;
  // Wallet layout adapted from the supplied Uiverse example by nazar-gavrylyk.
  return <div className="modal-back" onClick={onClose}>
    <section className="modal wallet-modal wallet-plain wallet-card" role="dialog" aria-modal="true"
      aria-labelledby="cashier-title" onClick={event=>event.stopPropagation()}
      onKeyDown={event=>{if(event.key==="Escape") onClose();}}>
      <header className="cashier-head">
        <div className="wallet-card-heading">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 6h17v14H3z M3 6l14-3v3 M20 11h-6v4h6"/>
          </svg>
          <div><h2 id="cashier-title">Wallet</h2><strong>{formatUSD(balance)}</strong><span>Play USD</span></div>
        </div>
        <button type="button" className="text-btn" onClick={onClose} autoFocus>Close</button>
      </header>
      <div className="wallet-card-details">
        <div><strong>Rain</strong><p>Open chat to join Rain and earn Play USD.</p></div>
        <div><strong>Rakeback</strong><p>Signed-in house-game wagers earn 0.2% automatically.</p></div>
      </div>
      <Link className="bet-btn" to="/chat" onClick={onClose}>Open chat</Link>
      <p className="wallet-plain-foot">Play money only. Top-ups are disabled.</p>
    </section>
  </div>;
}
