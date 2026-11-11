import {useEffect,useRef,useState,type FormEvent} from "react";
import {formatUSD,MAX_BALANCE} from "../lib/money";
import {useWallet} from "../state/wallet";
import "./wallet-plain.css";

type Receipt={id:string;amount:number};
export function Cashier({open,onClose}:{open:boolean;onClose:()=>void}){
 const {balance,syncSocialWallet}=useWallet();
 const [code,setCode]=useState("");
 const [amount,setAmount]=useState("10.00");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [receipt,setReceipt]=useState<Receipt|null>(null);
 const [remaining,setRemaining]=useState<number|null>(null);
 const pending=useRef<{id:string;amount:number;code:string}|null>(null);
 useEffect(()=>{
  if(!open)return;
  let active=true;
  void fetch("/api/auth/demo-voucher",{cache:"no-store"}).then(async r=>r.ok?r.json():null).then(data=>{
   if(active&&Number.isSafeInteger(data?.remainingCents))setRemaining(data.remainingCents);
  }).catch(()=>{});
  return()=>{active=false;};
 },[open,receipt]);
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(busy)return;
  const cents=Math.round(Number(amount)*100);
  const voucher=code.trim().toUpperCase();
  if(!/^PBDEMO-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(voucher)){
   setError("Enter your BlockBet demo voucher code.");return;
  }
  if(!Number.isSafeInteger(cents)||cents<100||cents>12500){
   setError("Choose between $1.00 and $125.00.");return;
  }
  if(balance+cents>MAX_BALANCE){setError("This would exceed the maximum Play USD wallet balance.");return;}
  const same=pending.current?.amount===cents&&pending.current?.code===voucher;
  const id=same?pending.current!.id:crypto.randomUUID();
  pending.current={id,amount:cents,code:voucher};
  setError("");setBusy(true);
  try{
   const response=await fetch("/api/auth/demo-voucher",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({id,code:voucher,cents})});
   const result=await response.json() as {ok?:boolean;error?:string};
   if(!response.ok||!result.ok)throw new Error(result.error||"Voucher declined.");
   setReceipt({id,amount:cents});pending.current=null;
   syncSocialWallet();
  }catch(err){setError(err instanceof Error?err.message:"Unable to reach the demo voucher.");}
  finally{setBusy(false);}
 };
 const close=()=>{setReceipt(null);setError("");onClose();};
 if(!open)return null;
 return <div className="modal-back" role="presentation" onClick={close}>
  <div className="modal wallet-modal wallet-plain" role="dialog" aria-labelledby="cashier-title" onClick={event=>event.stopPropagation()}>
   <header className="cashier-head">
     <div><h2 id="cashier-title">Play USD Wallet</h2><p className="hint">Game balance: <strong>{formatUSD(balance)}</strong></p></div>
     <button className="text-btn" type="button" onClick={close}>Close</button>
   </header>
   {receipt?<div className="receipt" role="status">
     <span className="receipt-mark">✓</span><h3>Demo credits accepted</h3>
     <strong>{formatUSD(receipt.amount)}</strong>
     <p>Your Play USD wallet will update when the credit event synchronises.</p>
     <small>Receipt {receipt.id.slice(0,8).toUpperCase()} · Fictional credits only</small>
     <button className="bet-btn" type="button" onClick={()=>setReceipt(null)}>Done</button>
   </div>:<>
     <div className="wallet-plain-intro">
       <strong>Redeem demo credits</strong>
       <span>Enter your BlockBet-only voucher. No real bank card, personal details or external payments are accepted.</span>
     </div>
     {remaining!==null&&<p className="wallet-admin-remaining">Shared test funds remaining: <strong>{formatUSD(remaining)}</strong></p>}
     <form className="wallet-plain-form" onSubmit={event=>void submit(event)}>
       <label className="field"><span className="field-label">BlockBet demo voucher code</span><span className="amount">
         <input required autoComplete="off" placeholder="PBDEMO-XXXX-XXXX" maxLength={16} value={code}
           onChange={event=>setCode(event.target.value.toUpperCase().slice(0,16))}/>
       </span></label>
       <label className="field"><span className="field-label">Amount in Play USD</span><span className="amount">
         <span className="amount-prefix">$</span>
         <input required inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)}/>
       </span></label>
       <div className="quick-amounts">
         {["5.00","10.00","25.00","50.00"].map(v=><button type="button" key={v}
           onClick={()=>setAmount(v)}>{"$"+Number(v)}</button>)}
       </div>
       {error&&<p className="form-error" role="alert">{error}</p>}
       <button className="bet-btn" type="submit" disabled={busy}>
         {busy?"Processing…":"Add "+formatUSD(Math.max(0,Math.round(Number(amount)*100)||0))+" demo credits"}
       </button>
     </form>
     <p className="wallet-plain-foot">A voucher accesses one shared pool of simulated funds; every redemption reduces its balance for everyone. It does not spend real money or work outside PlayBlockBet.</p>
   </>}
  </div>
 </div>;
}
