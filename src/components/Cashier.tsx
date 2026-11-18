import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";
import "./wallet-plain.css";
export function Cashier({open,onClose}:{open:boolean;onClose:()=>void}){
 const {balance,syncSocialWallet,walletReady}=useWallet();
 const {isGuest}=useAuth();
 const [showVoucher,setShowVoucher]=useState(false),[number,setNumber]=useState(""),[expiry,setExpiry]=useState(""),[code,setCode]=useState(""),[amount,setAmount]=useState("25");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const receipt=useRef<string|null>(null);
 async function redeem(e:FormEvent){
  e.preventDefault();if(busy)return;setError("");setNotice("");
  const cents=Math.round(Number(amount)*100);
  if(!/^\d+(\.\d{1,2})?$/.test(amount)||!Number.isSafeInteger(cents)||cents<100||cents>12500){setError("Enter $1 to $125.");return;}
  setBusy(true);
  try{
   const id=receipt.current||crypto.randomUUID();receipt.current=id;
   const response=await fetch("/api/auth/demo-card",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,cents,number:number.trim(),expiry:expiry.trim(),code:code.trim().toUpperCase()})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||"Test card failed.");
   receipt.current=null;setNotice(formatUSD(cents)+" credited to your Play USD balance.");setShowVoucher(false);syncSocialWallet();
  }catch(err){setError(err instanceof Error?err.message:"Test card unavailable.");}
  finally{setBusy(false);}
 }
 if(!open)return null;
 return <div className="modal-back" onClick={onClose}><section className="modal wallet-modal wallet-plain" role="dialog" aria-modal="true" aria-labelledby="cashier-title" onClick={e=>e.stopPropagation()}>
  <header className="cashier-head"><h2 id="cashier-title">Play-money wallet</h2><button className="text-btn" type="button" onClick={onClose}>Close</button></header>
  <h3>{formatUSD(balance)}</h3><p>Every account starts with $1,000 once. Normal top-ups are disabled.</p>
  <p>Keep playing with your winnings, receive money from another player, or join Rain in chat.</p>
  <Link className="bet-btn" to="/chat" onClick={onClose}>Open chat and Rain</Link>
  {!isGuest&&<div className="test-card-redeem"><button className="ghost-btn" type="button" onClick={()=>setShowVoucher(v=>!v)} aria-expanded={showVoucher}>{showVoucher?"Hide":"Redeem"} internal demo card</button>
    {showVoucher&&<form onSubmit={redeem}><p>BlockBet test voucher only. Not a bank card or real payment method.</p>
      <label>Test card ID<input autoComplete="off" required value={number} onChange={e=>{setNumber(e.target.value);receipt.current=null;}} placeholder="BB-DEMO-…" /></label>
      <div className="test-card-fields"><label>Expiry<input required value={expiry} onChange={e=>{setExpiry(e.target.value);receipt.current=null;}} placeholder="MM/YY"/></label><label>Code<input required value={code} onChange={e=>{setCode(e.target.value);receipt.current=null;}} maxLength={6}/></label></div>
      <label>Play USD amount<input inputMode="decimal" required value={amount} onChange={e=>{setAmount(e.target.value);receipt.current=null;}}/></label>
      <button type="submit" className="bet-btn" disabled={busy||!walletReady}>{busy?"Redeeming…":"Redeem simulated funds"}</button>
    </form>}
  </div>}
  {error&&<p className="neg" role="alert">{error}</p>}{notice&&<p className="pos" role="status">{notice}</p>}
  <p className="wallet-plain-foot">Play money only – no cash value.</p>
 </section></div>;
}
