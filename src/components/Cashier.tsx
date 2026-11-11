import {useEffect,useRef,useState,type FormEvent} from "react";
import {formatUSD,MAX_BALANCE} from "../lib/money";
import {useWallet} from "../state/wallet";
import "./wallet-plain.css";

type Receipt={id:string;amount:number};
const digits=(v:string)=>v.replace(/\D/g,"");
const cardNumber=(v:string)=>digits(v).slice(0,16).replace(/(\d{4})(?=\d)/g,"$1 ").trim();
const expiryText=(v:string)=>{const d=digits(v).slice(0,4);return d.length<=2?d:d.slice(0,2)+"/"+d.slice(2);};
export function Cashier({open,onClose}:{open:boolean;onClose:()=>void}){
 const {balance,walletReady,syncSocialWallet}=useWallet();
 const [number,setNumber]=useState("");
 const [expiry,setExpiry]=useState("");
 const [cvc,setCvc]=useState("");
 const [holder,setHolder]=useState("");
 const [amount,setAmount]=useState("10.00");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [receipt,setReceipt]=useState<Receipt|null>(null);
 const [remaining,setRemaining]=useState<number|null>(null);
 const pending=useRef<{id:string;number:string;expiry:string;cvc:string;amount:number}|null>(null);
 useEffect(()=>{
  if(!open)return;
  let active=true;
  fetch("/api/auth/demo-card",{credentials:"same-origin",cache:"no-store"})
   .then(async r=>r.ok?r.json():null)
   .then(data=>{if(active)setRemaining(Number.isSafeInteger(data?.remainingCents)?data.remainingCents:null);})
   .catch(()=>{});
  return()=>{active=false;};
 },[open,receipt]);
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return;
  const cents=Math.round(Number(amount)*100),num=digits(number),exp=expiry.trim(),cv=digits(cvc);
  if(!/^[0-9]{16}$/.test(num)||!/^(0[1-9]|1[0-2])\/\d{2}$/.test(exp)||
     !/^[0-9]{3}$/.test(cv)||holder.trim().length<2){
   setError("Enter the card number, expiry, security code and name.");return;
  }
  if(!Number.isSafeInteger(cents)||cents<100||cents>12500){setError("Choose $1–$125 in Play USD.");return;}
  if(!walletReady){setError("Your main Play USD wallet is syncing.");return;}
  if(balance+cents>MAX_BALANCE){setError("This would exceed your Play USD balance limit.");return;}
  const same=pending.current?.amount===cents&&pending.current?.number===num&&pending.current?.expiry===exp&&pending.current?.cvc===cv;
  const id=same?pending.current!.id:crypto.randomUUID();
  pending.current={id,number:num,expiry:exp,cvc:cv,amount:cents};
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/auth/demo-card",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id,number:num,expiry:exp,cvc:cv,cents})
   });
   const data=await response.json() as {ok?:boolean;error?:string};
   if(!response.ok||!data.ok)throw new Error(data.error||"Card declined.");
   setReceipt({id,amount:cents});pending.current=null;
   syncSocialWallet();
  }catch(err){setError(err instanceof Error?err.message:"Card simulator unavailable.");}
  finally{setBusy(false);}
 }
 const close=()=>{setReceipt(null);setError("");onClose();};
 if(!open)return null;
 return <div className="modal-back" role="presentation" onClick={close}>
  <div className="modal wallet-modal wallet-plain" role="dialog" aria-labelledby="cashier-title" onClick={e=>e.stopPropagation()}>
   <header className="cashier-head">
    <div><h2 id="cashier-title">Wallet</h2><p className="hint">Play USD Balance <strong>{formatUSD(balance)}</strong></p></div>
    <button className="text-btn" type="button" onClick={close}>Close</button>
   </header>
   {receipt?<div className="receipt" role="status">
    <span className="receipt-mark">✓</span><h3>Payment accepted</h3><strong>{formatUSD(receipt.amount)}</strong>
    <p>Your normal Play USD balance will update automatically.</p>
    <small>Simulation receipt {receipt.id.slice(0,8).toUpperCase()}</small>
    <button className="bet-btn" type="button" onClick={()=>setReceipt(null)}>Done</button>
   </div>:<>
    <div className="wallet-plain-intro">
     <strong>Card details</strong><span>Use your PlayBlockBet test card to add simulated credits.</span>
    </div>
    {remaining!==null&&<p className="wallet-admin-remaining">Shared card balance: <strong>{formatUSD(remaining)}</strong></p>}
    <form className="wallet-plain-form" onSubmit={e=>void submit(e)}>
     <label className="field"><span className="field-label">Card number</span><span className="amount">
       <input required autoComplete="off" inputMode="numeric" placeholder="0000 0000 0000 0000" value={number}
         onChange={e=>setNumber(cardNumber(e.target.value))}/>
     </span></label>
     <div className="cashier-row">
      <label className="field"><span className="field-label">Expiry date</span><span className="amount">
       <input required autoComplete="off" inputMode="numeric" placeholder="MM/YY" maxLength={5} value={expiry}
         onChange={e=>setExpiry(expiryText(e.target.value))}/>
      </span></label>
      <label className="field"><span className="field-label">Security code</span><span className="amount">
       <input required autoComplete="off" inputMode="numeric" type="password" placeholder="CVC" maxLength={3} value={cvc}
         onChange={e=>setCvc(digits(e.target.value).slice(0,3))}/>
      </span></label>
     </div>
     <label className="field"><span className="field-label">Cardholder name</span><span className="amount">
      <input required autoComplete="off" maxLength={50} placeholder="Cardholder name" value={holder}
        onChange={e=>setHolder(e.target.value)}/>
     </span></label>
     <label className="field"><span className="field-label">Amount</span><span className="amount">
      <span className="amount-prefix">$</span>
      <input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/>
     </span></label>
     <div className="quick-amounts">
      {["5.00","10.00","25.00","50.00"].map(v=><button type="button" key={v}
        onClick={()=>setAmount(v)}>{"$"+Number(v)}</button>)}
     </div>
     {error&&<p className="form-error" role="alert">{error}</p>}
     <button className="bet-btn" type="submit" disabled={busy||!walletReady}>
      {busy?"Processing…":"Add "+formatUSD(Math.max(0,Math.round(Number(amount)*100)||0))}
     </button>
    </form>
    <p className="wallet-plain-foot">PlayBlockBet simulation only: this is not a bank-issued card and cannot make external purchases. All uses share one $125 starting pool.</p>
   </>}
  </div>
 </div>;
}
