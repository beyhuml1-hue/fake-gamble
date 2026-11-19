import {useEffect,useRef,useState,type FormEvent} from 'react';
import {CARD_BUNDLES,casePayout,packForPrice,pickBundle} from '../../functions/_shared/case-cards.js';
import {useWallet} from '../state/wallet';
import {useAuth} from '../components/AuthProvider';
import {formatUSD} from '../lib/money';
import {random} from '../lib/random';
import {apiJSON,ApiError,errorMessage} from '../lib/api';
import './card-cases.css';

type Opening={id:string;stake:number;bundle:number;cards:number[];payout:number};
const label=(mult:number)=>`${mult}×`;
const finishFor=(mult:number)=>mult>=6?'obsidian':mult>=3?'gold':mult>=1?'prismatic':mult>=.4?'holo':mult>=.16?'silver':'matte';
const cardNames=['Eevee','Pikachu','Mewtwo','Charizard'];
const cardArt=['eevee','pikachu','mewtwo','charizard'];
export function Collectible({mult,index,stake,revealed,onReveal}:{mult:number;index:number;stake:number;revealed:boolean;onReveal:()=>void}) {
 const ref=useRef<HTMLButtonElement>(null);
 const finish=finishFor(mult);
 const finishName=finish==='obsidian'?'Matte black':finish==='gold'?'Gold etched':finish==='prismatic'?'Prismatic':finish==='holo'?'Holographic':finish==='silver'?'Silver foil':'Matte';
 const reset=()=>{
   const node=ref.current;if(!node)return;
   node.dataset.active='false';node.style.setProperty('--rx','0deg');node.style.setProperty('--ry','0deg');
 };
 return <button ref={ref} type="button" className={`collectible ${finish}${revealed?' revealed':''}`} aria-label={revealed?`${cardNames[index]}, ${mult} times, ${formatUSD(Math.round(stake*mult))}, ${finishName}`:`Reveal card ${index+1}`}
   onClick={onReveal} onPointerMove={event=>{
     const bounds=event.currentTarget.getBoundingClientRect();
     const x=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
     const y=Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height));
     const node=event.currentTarget,style=node.style;
     node.dataset.active='true';
     style.setProperty('--mx',`${50+(x-.5)*66.67}%`);style.setProperty('--my',`${50+(y-.5)*66.67}%`);
     style.setProperty('--sx',`${50+(x-.5)*14.29}%`);style.setProperty('--sy',`${50+(y-.5)*14.29}%`);
     style.setProperty('--glare',String(Math.min(1,.2+Math.abs(x+y-1)*1.5)));
     style.setProperty('--rx',`${(y-.5)*-18}deg`);style.setProperty('--ry',`${(x-.5)*26}deg`);
   }} onPointerLeave={reset} onPointerCancel={reset}>
   <span className="collectible-inner">
     <span className="collectible-back"><span className="card-seal">B</span><span>Tap to reveal</span></span>
     <span className="collectible-front">
       <img className="card-face" src={`/cards/${cardArt[index]}.webp`} alt={`${cardNames[index]} card artwork`} draggable={false}/>
       <span className="card-foil"/><span className="card-sparkles"/><span className="card-glare"/><span className="card-etching"/>
     </span>
   </span>
   <span className="card-payout" aria-hidden="true"><strong>{revealed?label(mult):'?'}</strong><span>{revealed?formatUSD(Math.round(stake*mult)):'Unrevealed'}</span><small>{revealed?finishName:'Tap to reveal'}</small></span>
 </button>;
}
export function Cases(){
 const {balance,debit,credit,record,prepareTransfer,syncSocialWallet,walletReady}=useWallet();
 const {isGuest,email}=useAuth();
 const receiptKey=`blockbet.case.receipt:${email??'guest'}`;
 const restoreReceipt=()=>{try{const value=JSON.parse(localStorage.getItem(receiptKey)||'null');return value&&/^[a-f0-9-]{36}$/i.test(value.id)&&Number.isSafeInteger(value.stake)&&value.stake>=100&&value.stake<=100_000_000?value:null;}catch{return null;}};
 const [amount,setAmount]=useState(()=>String((restoreReceipt()?.stake??1000)/100));
 const [phase,setPhase]=useState<'ready'|'requesting'|'sealed'|'tearing'|'cards'>('ready');
 const [opening,setOpening]=useState<Opening|null>(null);
 const [revealed,setRevealed]=useState<number[]>([]);
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(()=>Boolean(restoreReceipt()));
 const receipt=useRef<{id:string;stake:number}|null>(restoreReceipt());
 const locked=useRef(false);
 const mounted=useRef(true);
 const tearTimer=useRef(0);
 const rebateRemainder=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;window.clearTimeout(tearTimer.current);};},[]);
 const stake=Math.round(Number(amount)*100);
 const pack=packForPrice(opening?.stake??stake);
 const busy=phase==='requesting'||phase==='sealed'||phase==='tearing'||phase==='cards'&&revealed.length<4;
 async function open(event:FormEvent){
   event.preventDefault();if(locked.current||busy)return;
   if(!retry&&(!/^\d+(\.\d{1,2})?$/.test(amount)||stake<100||stake>100_000_000)){setError('Enter a price between $1 and $1,000,000.');return;}
   locked.current=true;setError('');setPhase('requesting');
   const request=receipt.current??{id:crypto.randomUUID(),stake};receipt.current=request;
   if(!isGuest)try{localStorage.setItem(receiptKey,JSON.stringify(request));}catch{/* Retry still works in memory. */}
   try{
     let result:Opening;
     if(isGuest){
       if(!debit(request.stake))throw new Error('Not enough Play USD.');
       const bundle=pickBundle(random());
       result={...request,bundle,cards:CARD_BUNDLES[bundle].cards,payout:casePayout(request.stake,bundle)};
       const units=rebateRemainder.current+request.stake;
       credit(result.payout+Math.floor(units/500));rebateRemainder.current=units%500;
     }else{
       if(await prepareTransfer()===null)throw new Error('Your wallet is still syncing. Wait a moment and retry.');
       result=await apiJSON<Opening>('/api/auth/cases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
       syncSocialWallet();
     }
     record('Cases',result.stake,result.payout);
     receipt.current=null;
     try{localStorage.removeItem(receiptKey);}catch{/* Storage is optional. */}
     if(mounted.current){setOpening(result);setRevealed([]);setPhase('sealed');setRetry(false);}
   }catch(err){
     const uncertain=!isGuest&&(!(err instanceof ApiError)||err.status>=500);
     if(!uncertain){receipt.current=null;try{localStorage.removeItem(receiptKey);}catch{/* Storage is optional. */}}
     if(mounted.current){setRetry(uncertain);setError(errorMessage(err));setPhase('ready');}
   }finally{locked.current=false;}
 }
 const allRevealed=phase==='cards'&&revealed.length===4;
 const changePrice=(value:string)=>{setAmount(value);setOpening(null);setPhase('ready');};
 return <section className="card-cases" data-screen="card-cases">
   <header className="card-cases-title"><h1>Cases</h1><p>One pack. Four cards. Every reveal counts.</p></header>
   <div className="card-cases-layout">
     <div className={`card-cases-stage ${phase}`}>
       {phase==='cards'&&opening?<div className="collectible-grid">{opening.cards.map((mult,index)=><Collectible key={`${opening.id}-${index}`} mult={mult} index={index} stake={opening.stake} revealed={revealed.includes(index)} onReveal={()=>setRevealed(prev=>prev.includes(index)?prev:[...prev,index])}/>)}</div>:
       <button type="button" className={`sealed-pack ${pack.toLowerCase()}`} disabled={phase!=='sealed'} aria-label={phase==='sealed'?'Tear open your pack':`${pack} pack preview`} onClick={()=>{setPhase('tearing');tearTimer.current=window.setTimeout(()=>setPhase('cards'),650);}}>
         <span className="pack-crimp top"/><span className="pack-wordmark">BlockBet</span><span className="pack-emblem" aria-hidden="true">B</span><strong>{pack}</strong><span className="pack-caption">Four collectible cards</span><span className="pack-crimp bottom"/>
       </button>}
       <div className="pack-status" role="status" aria-live="polite">{phase==='requesting'?'Preparing your pack…':phase==='tearing'?'Opening your pack…':phase==='sealed'?'Your pack is ready. Tap to tear it open.':phase==='cards'?allRevealed?`Four cards revealed · ${formatUSD(opening!.payout)} total`:'Tap each card to reveal it.':'Set your price. Your pack changes automatically.'}</div>
       {phase==='cards'&&!allRevealed&&<button type="button" className="pack-reveal-all" onClick={()=>setRevealed([0,1,2,3])}>Reveal all four</button>}
     </div>
     <form className="pack-purchase" onSubmit={open}>
       <h2>{pack} pack</h2><p>Higher prices unlock a different wrapper. All packs use the same published odds.</p>
       <label htmlFor="case-price">Pack price · Play USD</label>
       <div className="pack-price-input"><span>$</span><input id="case-price" inputMode="decimal" type="number" min="1" max="1000000" step="0.01" value={amount} disabled={busy||retry} onChange={e=>changePrice(e.target.value)}/></div>
       <div className="pack-price-actions"><button type="button" disabled={busy||retry} onClick={()=>changePrice(String(Math.max(1,Math.round(Number(amount)*50)/100)))}>Half</button><button type="button" disabled={busy||retry} onClick={()=>changePrice(String(Math.min(1_000_000,balance/100,Math.round(Number(amount)*200)/100)))}>Double</button></div>
       <p className="pack-balance">Balance <strong>{formatUSD(balance)}</strong></p>
       <button type="submit" className="pack-buy" disabled={busy||!isGuest&&!walletReady}>{phase==='requesting'?'Preparing…':retry?'Recover opening':allRevealed?'Open another pack':'Open pack'}</button>
       {allRevealed&&<div className="pack-total"><span>Cards returned</span><strong>{formatUSD(opening!.payout)}</strong><span>{(opening!.payout/opening!.stake).toFixed(2)}× combined</span></div>}
       {error&&<p role="alert" className="form-error">{error}</p>}
       <p className="pack-economy">98% base return · 2% house edge.<br/>Rakeback returns 10% of that edge: 0.2% of your spend. Net theoretical edge: 1.8%.</p>
     </form>
   </div>
   <details className="pack-probabilities"><summary>Card returns and odds</summary><p>Each pack contains one of these four-card combinations. Add the four multipliers for the total return on your pack price. Values include your stake and round to cents. Price changes the wrapper, not the odds.</p><div className="pack-odds-rows">{CARD_BUNDLES.map((bundle,i)=><div key={i}><span>{bundle.cards.map(label).join(' + ')}</span><strong>{bundle.weight/100}%</strong></div>)}</div><p>Foil inspired by <a href="https://poke-holo.simey.me/" target="_blank" rel="noreferrer">Simey's holographic cards</a>. Card artwork from the supplied demo by Simey. Pokémon artwork belongs to its respective owners. Play USD has no cash value.</p></details>
 </section>;
}
