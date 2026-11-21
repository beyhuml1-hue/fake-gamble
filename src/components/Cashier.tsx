import { useState } from "react";
import { Link } from "react-router-dom";
import { formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";
import "./wallet-plain.css";

const MOVES = [50, 100, 300];

export function Cashier({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { balance, cardBalance, withdrawToCard } = useWallet();
  const [folded, setFolded] = useState(false);
  const [pocket, setPocket] = useState<"play" | "card">("play");
  const [note, setNote] = useState("");
  if (!open) return null;

  const move = (dollars: number) => {
    if (pocket !== "play") {
      setNote("Top-ups are disabled. Choose Play USD to move money onto the card.");
      return;
    }
    const cents = Math.round(dollars * 100);
    const error = withdrawToCard(cents);
    setNote(error || `Moved ${formatUSD(cents)} onto the card.`);
  };

  return <div className="modal-back" onClick={onClose}>
    <section className={"wallet-fold" + (folded ? " is-folded" : "")} role="dialog" aria-modal="true"
      aria-labelledby="cashier-title" onClick={event => event.stopPropagation()}
      onKeyDown={event => { if (event.key === "Escape") onClose(); }}>
      <header className="wallet-fold-head">
        <div className="wallet-fold-id">
          <span className="wallet-fold-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
            </svg>
          </span>
          <div>
            <p>Wallet</p>
            <strong id="cashier-title">{formatUSD(balance)}</strong>
          </div>
        </div>
        <button type="button" className="wallet-fold-x" aria-label="Fold wallet" autoFocus onClick={() => setFolded(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </header>
      <div className="wallet-fold-body">
        <div className="wallet-fold-rowhead">
          <p>Pockets</p>
        </div>
        <div className="wallet-fold-pockets">
          <label className={pocket === "play" ? "on" : ""}>
            <input type="radio" name="wallet-pocket" checked={pocket === "play"} onChange={() => setPocket("play")} />
            <span>Play USD</span>
            <b>{formatUSD(balance)}</b>
          </label>
          <label className={pocket === "card" ? "on" : ""}>
            <input type="radio" name="wallet-pocket" checked={pocket === "card"} onChange={() => setPocket("card")} />
            <span>Card</span>
            <b>{formatUSD(cardBalance)}</b>
          </label>
        </div>
        <div className="wallet-fold-extra">
          <p><b>Rain</b> Open chat to join Rain.</p>
          <p><b>Rakeback</b> House wagers earn 0.2%.</p>
          <Link to="/chat" onClick={onClose}>Open chat</Link>
        </div>
        <div className="wallet-fold-cash">
          <p>Move to card</p>
          <div>
            {MOVES.map(amount => <button key={amount} type="button" onClick={() => move(amount)}>${amount}</button>)}
          </div>
        </div>
        {note ? <p className="wallet-fold-note">{note}</p> : null}
        <p className="wallet-plain-foot">Play money only. These amounts move Play USD onto the card. They do not add new money.</p>
      </div>
      <button type="button" className="wallet-fold-open" onClick={() => setFolded(false)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12h14" /><path d="M12 5v14" />
        </svg>
        Open wallet
      </button>
    </section>
  </div>;
}
