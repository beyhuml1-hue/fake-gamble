import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PACK_LEVELS,PACK_ODDS,packMax,packRtp,pickPackPrize,type PackDifficulty,type PackPrize } from "../data/packs";
import { betCents,formatUSD,MAX_BALANCE,payout } from "../lib/money";
import { sound } from "../lib/sound";
import { useWallet } from "../state/wallet";
import "./packs.css";

const REEL_CELL=134;
const PRIZE_INDEX=37;
const REEL_COUNT=48;
const SPIN_MS=3650;
const multLabel=(n:number)=>Number(n.toFixed(2)).toString()+"×";

function PackIllustration({prize}:{prize:PackPrize}){
 return <div className={"packs-wrapper "+prize.color} aria-label={multLabel(prize.mult)+" "+prize.color+" pack"}>
    <i className="packs-wrapper-gloss" aria-hidden="true"/>
    <i className="packs-wrapper-label" aria-hidden="true"><span/><span/></i>
    <b className="packs-wrapper-mult">{multLabel(prize.mult)}</b>
  </div>;
}

export function Packs(){
 const {balance,debit,credit,record,history}=useWallet();
 const [amount,setAmount]=useState(1);
 const [level,setLevel]=useState<PackDifficulty>("Easy");
 const [strip,setStrip]=useState<PackPrize[]>(()=>Array.from({length:12},()=>pickPackPrize("Easy")));
 const [shift,setShift]=useState(0);
 const [spinning,setSpinning]=useState(false);
 const [result,setResult]=useState<PackPrize|null>(null);
 const [error,setError]=useState("");
 const [stake,setStake]=useState(0);
 const [reelReady,setReelReady]=useState(false);
 const viewport=useRef<HTMLDivElement>(null);
 const timeout=useRef<number|undefined>(undefined);
 const tickFrame=useRef<number|undefined>(undefined);
 const frames=useRef<number|undefined>(undefined);
 const active=useRef(false);
 const unsettled=useRef<{stake:number;pay:number}|null>(null);
 const actions=useRef({credit,record});
 actions.current={credit,record};

 // Complete any in-flight wager if the player navigates away mid-spin.
 // WalletProvider persists while changing pages, so a settled prize is never lost.
 useEffect(()=>()=> {
   window.clearTimeout(timeout.current);
   if(tickFrame.current!==undefined)cancelAnimationFrame(tickFrame.current);
   if(frames.current!==undefined)cancelAnimationFrame(frames.current);
   const due=unsettled.current;
   if(due){
     unsettled.current=null;
     if(due.pay>0)actions.current.credit(due.pay);
     actions.current.record("Packs",due.stake,due.pay);
   }
 },[]);

 const prizes=PACK_ODDS[level];
 const best=packMax(level);
 const recent=useMemo(()=>history.filter(h=>h.game==="Packs").slice(0,4),[history]);
 const maxBet=Math.floor(MAX_BALANCE/best);
 const wager=Math.round(amount*100);
 const open=()=>{
   if(active.current)return;
   const bet=betCents(amount,balance);
   if(bet===null){setError("Enter a bet of at least $0.10 within your Play USD balance.");return;}
   if(bet>maxBet){setError("Maximum "+level+" bet is "+formatUSD(maxBet)+" so all prizes can be paid in full.");return;}
   active.current=true;
   if(!debit(bet)){active.current=false;setError("Insufficient Play USD.");return;}
   const prize=pickPackPrize(level);
   const pay=payout(bet,prize.mult);
   unsettled.current={stake:bet,pay};
   const next=Array.from({length:REEL_COUNT},()=>pickPackPrize(level));
   next[PRIZE_INDEX]=prize;
   setStrip(next);
   setResult(null);
   setStake(bet);
   setShift(0);
   setReelReady(false);
   setSpinning(true);
   setError("");

   // Double rAF ensures the strip resets before the long transition begins.
   frames.current=requestAnimationFrame(()=>{
     frames.current=requestAnimationFrame(()=>{
       const width=viewport.current?.clientWidth||560;
       const destination=PRIZE_INDEX*REEL_CELL-(width-124)/2;
       setReelReady(true);
       setShift(Math.max(0,destination));
       let last=-1;
       const began=performance.now();
       const watch=(now:number)=>{
         const t=Math.min(1,(now-began)/SPIN_MS);
         const eased=1-Math.pow(1-t,4.2);
         const index=Math.round(destination*eased/REEL_CELL);
         if(index!==last){last=index;sound.tick();}
         if(t<1)tickFrame.current=requestAnimationFrame(watch);
       };
       tickFrame.current=requestAnimationFrame(watch);
     });
   });
   timeout.current=window.setTimeout(()=>{
     if(tickFrame.current!==undefined)cancelAnimationFrame(tickFrame.current);
     const due=unsettled.current;
     unsettled.current=null;
     if(due){
       if(due.pay>0)actions.current.credit(due.pay);
       actions.current.record("Packs",due.stake,due.pay);
     }
     setResult(prize);
     setSpinning(false);
     active.current=false;
   },SPIN_MS+90);
 };
 const changeLevel=(chosen:PackDifficulty)=>{
   if(active.current)return;
   setLevel(chosen);
   setStrip(Array.from({length:12},()=>pickPackPrize(chosen)));
   setResult(null);setShift(0);setReelReady(false);setError("");
 };
 const submit=(event:FormEvent)=>{
   event.preventDefault();open();
 };
 const maxPayout=payout(Math.max(0,wager),best);
 return <section className="packs-page">
   <header className="packs-header">
     <div><span className="packs-eyebrow">BLOCKBET ORIGINALS</span><h1>Packs</h1><p>Pick a difficulty, open a pack and watch the reel land.</p></div>
     <div className="packs-header-preview"><img src="/covers/cover-packs.webp" alt="Plain silver mystery pack"/></div>
   </header>
   <div className="packs-game">
     <div className="packs-stage">
       <div className="packs-stage-head">
         <span><i/> PACKS REEL</span>
         <div className="packs-recent">
           {recent.length?recent.map(h=><span key={h.id}>{multLabel(h.wager>0?h.payout/h.wager:0)}</span>):<span>LIVE MULTIPLIERS</span>}
         </div>
       </div>
       <div className="packs-viewport" ref={viewport}>
         <div className="packs-marker" aria-hidden="true"><span/></div>
         <div className={"packs-strip"+(reelReady?" animating":"")} style={{transform:"translate3d("+(-shift)+"px,0,0)"}}>
           {strip.map((prize,index)=><div key={index} className={"packs-reel-cell"+(result&&index===PRIZE_INDEX?" won":"")}>
             <PackIllustration prize={prize}/>
           </div>)}
         </div>
       </div>
       <div className="packs-colors" aria-label="Pack colour legend">
         {prizes.map(prize=><span key={prize.color} className={"packs-color "+prize.color} title={prize.color+" "+multLabel(prize.mult)+" · "+(prize.weight/100).toFixed(2)+"%"}/>)}
       </div>
       {result?<div role="status" className={"packs-outcome "+(result.mult>=1?"win":"lose")}>
         <strong>{multLabel(result.mult)}</strong>
         <span>{result.mult>1?"You won "+formatUSD(payout(stake,result.mult))+"!":
           result.mult===1?"Your stake was returned.":"Returned "+formatUSD(payout(stake,result.mult))+"."}</span>
       </div>:<div className="packs-prompt" role="status">{spinning?"Opening your pack…":"The white pointer shows the winning pack."}</div>}
     </div>
     <form className="packs-bet-controls" onSubmit={submit}>
       <button type="submit" className="packs-open-button" disabled={spinning}>
         {spinning?"Opening…":"Open pack"}
       </button>
       <div className="packs-bet-line"><span>Bet Amount</span><span>Balance: <strong>{formatUSD(balance)}</strong></span></div>
       <div className="packs-manual"><span>Manual</span><small>Every spin is independent</small></div>
       <label className="packs-amount-field">
         <span>Amount in Play USD</span>
         <div><span className="packs-dollar">$</span>
           <input inputMode="decimal" type="number" min="0.10" max={Math.min(balance/100,maxBet/100)} step="0.01"
              aria-label="Pack bet amount" value={amount} disabled={spinning}
              onChange={event=>setAmount(Number(event.target.value))}/>
           <button type="button" disabled={spinning} onClick={()=>setAmount(Math.max(.1,Math.round(amount*50)/100))}>½</button>
           <button type="button" disabled={spinning} onClick={()=>setAmount(Math.min(balance/100,maxBet/100,Math.round(amount*200)/100))}>2×</button>
         </div>
       </label>
       <div className="packs-difficulty-head"><label htmlFor="packs-difficulty">Difficulty</label><b>Max {multLabel(best)}</b></div>
       <select id="packs-difficulty" disabled={spinning} value={level} onChange={e=>changeLevel(e.target.value as PackDifficulty)}>
         {PACK_LEVELS.map(tier=><option key={tier} value={tier}>{tier}</option>)}
       </select>
       <div className="packs-pay-stat"><span>Max potential return</span><strong>{formatUSD(maxPayout)}</strong></div>
       {error&&<p className="form-error" role="alert">{error}</p>}
     </form>
     <section className="packs-odds" aria-label="Published Packs odds">
       <header><h2>{level} drops</h2><span>Expected return {(packRtp(level)*100).toFixed(2)}%</span></header>
       <div className="packs-odds-grid">{prizes.map(prize=><div key={prize.color} className="packs-odd-item">
         <span className={"packs-color "+prize.color}/>
         <b>{multLabel(prize.mult)}</b><small>{(prize.weight/100).toFixed(2)}%</small>
       </div>)}</div>
       <p>All multipliers include your original bet. Odds are fixed for each difficulty. The reel animation illustrates the weighted result; it does not change it. Play USD is fictional.</p>
     </section>
   </div>
 </section>;
}
