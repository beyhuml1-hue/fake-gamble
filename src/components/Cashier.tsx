import { Link } from "react-router-dom";
import { formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";
import "./wallet-plain.css";
export function Cashier({open,onClose}:{open:boolean;onClose:()=>void}){
 const {balance}=useWallet();if(!open)return null;
 return <div className="modal-back" onClick={onClose}><section className="modal wallet-modal wallet-plain" role="dialog" aria-modal="true" aria-labelledby="cashier-title" onClick={e=>e.stopPropagation()}>
 <header className="cashier-head"><h2 id="cashier-title">Play-money wallet</h2><button className="text-btn" onClick={onClose}>Close</button></header>
 <h3>{formatUSD(balance)}</h3><p>Every account starts with $1,000 once. Top-ups are disabled.</p><p>Keep playing with your winnings, receive money from another player, or join Rain in chat.</p>
 <p>Signed-in house-game wagers earn 0.2% rakeback automatically. Fractions accumulate until they reach a cent. Player matches and transfers are excluded.</p>
 <Link className="bet-btn" to="/chat" onClick={onClose}>Open chat and Rain</Link><p className="wallet-plain-foot">Play money only - no cash value.</p></section></div>;
}
