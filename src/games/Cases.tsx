import {useEffect,useRef,useState,type CSSProperties,type FormEvent} from 'react';
import {CARD_BUNDLES,casePayout,packForPrice,pickBundle} from '../../functions/_shared/case-cards.js';
import {useWallet} from '../state/wallet';
import {useAuth} from '../components/AuthProvider';
import {formatUSD} from '../lib/money';
import {random} from '../lib/random';
import {apiJSON,ApiError,errorMessage} from '../lib/api';
import './card-cases.css';

type Opening={id:string;stake:number;bundle:number;cards:number[];payout:number};
type Phase='ready'|'requesting'|'tearing'|'dealing'|'revealing'|'complete';
type Arena={name:string;sky:string;horizon:string;floor:string;glow:string;accent:string};
const ARENAS:Record<string,Arena>={
 '0.02':{name:'Midnight Flats',sky:'#0b1d38',horizon:'#405d79',floor:'#172e46',glow:'#78b5db',accent:'#cad8ff'},
 '0.04':{name:'Silver Valley',sky:'#193046',horizon:'#7b95a8',floor:'#314554',glow:'#c4f2ff',accent:'#edf5ff'},
 '0.05':{name:'Dawn Field',sky:'#263452',horizon:'#b6798e',floor:'#433c62',glow:'#ffb3bf',accent:'#f5d5e9'},
 '0.08':{name:'Tidal Terrace',sky:'#063c59',horizon:'#257d97',floor:'#124e64',glow:'#5ddce7',accent:'#c1f9ff'},
 '0.1':{name:'Skyfall Court',sky:'#1b365a',horizon:'#4788b6',floor:'#233f73',glow:'#76bbff',accent:'#d5ecff'},
 '0.16':{name:'Ember Grounds',sky:'#482340',horizon:'#ad5d62',floor:'#5f3447',glow:'#ffa878',accent:'#ffe1ba'},
 '0.2':{name:'Violet Circuit',sky:'#2b2057',horizon:'#7669bb',floor:'#38265c',glow:'#b6a8ff',accent:'#e7d5ff'},
 '0.4':{name:'Aurora Circuit',sky:'#113c51',horizon:'#438b9d',floor:'#185c66',glow:'#a7ffcf',accent:'#e1ffe2'},
 '0.5':{name:'Moonlit Garden',sky:'#233d48',horizon:'#74a18d',floor:'#1a5545',glow:'#99eab0',accent:'#dbffe2'},
 '1':{name:'Crystal Ring',sky:'#16384f',horizon:'#50b0c8',floor:'#146471',glow:'#8ef5ff',accent:'#f3ffff'},
 '1.2':{name:'Solar Summit',sky:'#6a3447',horizon:'#d69366',floor:'#785744',glow:'#ffd08e',accent:'#fff1cd'},
 '2.5':{name:'Nebula Rift',sky:'#28224d',horizon:'#9267a8',floor:'#4c337c',glow:'#f8a9ff',accent:'#ffe9ff'},
 '3':{name:'Radiant Basin',sky:'#59433a',horizon:'#d2a363',floor:'#795d39',glow:'#ffe9a0',accent:'#fff7d7'},
 '3.4':{name:'Sunspire Arena',sky:'#624037',horizon:'#d9a272',floor:'#8c6443',glow:'#ffdc7b',accent:'#fff3c7'},
 '6':{name:'Celestial Coliseum',sky:'#342d6e',horizon:'#ce98e9',floor:'#5d3b88',glow:'#f3b7ff',accent:'#fff4ff'},
 '36':{name:'Event Horizon',sky:'#020305',horizon:'#15151b',floor:'#08090e',glow:'#575968',accent:'#b7a5b3'}
};
const DEFAULT_ARENA=ARENAS['0.1']!;
const multLabel=(mult:number)=>Number(mult.toFixed(2)).toString()+'×';
const RETURN_LIMIT=100_000_000;


function Collectible({mult,index,stake,revealed}:{mult:number;index:number;stake:number;revealed:boolean}){
 const arena=ARENAS[String(mult)]??DEFAULT_ARENA;
 const voidCard=mult===36;
 const finish=voidCard?'obsidian':mult>=10?'mythic':mult>=3?'gold':mult>=1?'prismatic':mult>=.2?'holo':'silver';
 const ref=useRef<HTMLDivElement>(null);
 const reset=()=>{
   const node=ref.current;if(!node)return;
   node.dataset.active='false';
   node.style.setProperty('--rx','0deg');node.style.setProperty('--ry','0deg');
   node.style.setProperty('--glare','.45');
 };
 const style={'--arena-sky':arena.sky,'--arena-horizon':arena.horizon,'--arena-floor':arena.floor,'--arena-glow':arena.glow,'--arena-accent':arena.accent} as CSSProperties;
 return <div ref={ref} className={'collectible '+finish+(revealed?' revealed':'')+(voidCard?' void-card':'')} style={style}
   role="img" tabIndex={revealed?0:-1}
   aria-label={revealed?arena.name+': '+multLabel(mult)+' card, '+formatUSD(Math.round(stake*mult))+' returned':'Card '+(index+1)+', face down'}
   onPointerMove={event=>{
     if(!revealed)return;
     const rect=event.currentTarget.getBoundingClientRect();
     const x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));
     const y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));
     const node=event.currentTarget;
     node.dataset.active='true';
     node.style.setProperty('--mx',(50+(x-.5)*80)+'%');
     node.style.setProperty('--my',(50+(y-.5)*80)+'%');
     node.style.setProperty('--sx',(50+(x-.5)*20)+'%');
     node.style.setProperty('--sy',(50+(y-.5)*20)+'%');
     node.style.setProperty('--glare',String(Math.min(1,.25+Math.abs(x+y-1)*1.4)));
     node.style.setProperty('--rx',((y-.5)*-21)+'deg');
     node.style.setProperty('--ry',((x-.5)*32)+'deg');
   }}
   onPointerLeave={reset} onPointerCancel={reset} onBlur={reset}>
   <div className="collectible-inner">
     <div className="collectible-back" aria-hidden="true">
       <div className="back-orbit back-orbit-outer"/><div className="back-orbit back-orbit-inner"/>
       <span className="back-core"/><span className="back-brand">BLOCKBET</span>
     </div>
     <div className="collectible-front" aria-hidden="true">
       <div className="arena-scene"><img className="rift-card-image" src={"/cards/rift/"+String(mult).replace(".", "-")+".svg"} alt="" draggable={false} loading="eager"/></div>
       <span className="card-foil"/><span className="card-sparkles"/><span className="card-glare"/><span className="card-etching"/><span className="card-face-frame"/>
     </div>
   </div>
   <div className={'card-payout'+(revealed?' shown':'')}>
     <strong>{revealed?multLabel(mult):'—'}</strong>
     <span>{revealed?arena.name:'CARD '+(index+1)}</span>
     <small>{revealed?formatUSD(Math.round(stake*mult)):'SEALED'}</small>
   </div>
 </div>;
}

export function Cases(){
 const {balance,debit,credit,record,prepareTransfer,syncSocialWallet,walletReady}=useWallet();
 const {isGuest,email}=useAuth();
 const receiptKey='blockbet.case.receipt:'+(email??'guest');
 const restoreReceipt=()=>{
   try{
     const value=JSON.parse(localStorage.getItem(receiptKey)||'null');
     return value&&/^[a-f0-9-]{36}$/i.test(value.id)&&Number.isSafeInteger(value.stake)&&value.stake>=100&&value.stake<=RETURN_LIMIT?value:null;
   }catch{return null;}
 };
 const [amount,setAmount]=useState(()=>String((restoreReceipt()?.stake??1000)/100));
 const [phase,setPhase]=useState<Phase>('ready');
 const [opening,setOpening]=useState<Opening|null>(null);
 const [revealed,setRevealed]=useState<number[]>([]);
 const [spotlight,setSpotlight]=useState<'rare'|'void'|null>(null);
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(()=>Boolean(restoreReceipt()));
 const receipt=useRef<{id:string;stake:number}|null>(restoreReceipt());
 const locked=useRef(false);
 const mounted=useRef(true);
 const timers=useRef<number[]>([]);
 const rebateRemainder=useRef(0);
 const clearSequence=()=>{for(const t of timers.current)window.clearTimeout(t);timers.current=[];};
 const after=(ms:number,callback:()=>void)=>{
   const timer=window.setTimeout(()=>{if(mounted.current)callback();},ms);
   timers.current.push(timer);
 };
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;for(const t of timers.current)window.clearTimeout(t);timers.current=[];};},[]);
 const stake=Math.round(Number(amount)*100);
 const pack=packForPrice(opening?.stake??stake);
 const busy=phase!=='ready'&&phase!=='complete';
 const showCards=phase==='dealing'||phase==='revealing'||phase==='complete';
 const complete=phase==='complete'&&opening;
 const totalMult=opening?opening.payout/opening.stake:0;
 const net=opening?opening.payout-opening.stake:0;
 const spotlightActive=showCards&&spotlight!==null;

 async function open(event:FormEvent){
   event.preventDefault();
   if(locked.current||busy)return;
   if(!retry&&(!/^\d+(\.\d{1,2})?$/.test(amount)||!Number.isSafeInteger(stake)||stake<100||stake>RETURN_LIMIT)){
     setError('Enter a price between $1 and $1,000,000.');return;
   }
   locked.current=true;
   clearSequence();
   setError('');setOpening(null);setSpotlight(null);setRevealed([]);setPhase('requesting');
   const request=receipt.current??{id:crypto.randomUUID(),stake};
   receipt.current=request;
   if(!isGuest)try{localStorage.setItem(receiptKey,JSON.stringify(request));}catch{/* Retry also works in memory. */}
   try{
     let result:Opening;
     if(isGuest){
       if(!debit(request.stake))throw new Error('Not enough Play USD.');
       const bundle=pickBundle(random());
       result={...request,bundle,cards:CARD_BUNDLES[bundle].cards,payout:casePayout(request.stake,bundle)};
       const units=rebateRemainder.current+request.stake;
       credit(result.payout+Math.floor(units/500));
       rebateRemainder.current=units%500;
     }else{
       if(await prepareTransfer()===null)throw new Error('Your wallet is still syncing. Try again shortly.');
       result=await apiJSON<Opening>('/api/auth/cases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
       syncSocialWallet();
     }
     record('Rift Packs',result.stake,result.payout);
     receipt.current=null;
     try{localStorage.removeItem(receiptKey);}catch{/* Optional storage. */}
     if(mounted.current){
       setOpening(result);setRetry(false);setPhase('tearing');
       after(860,()=>setPhase('dealing'));
       after(1680,()=>setPhase('revealing'));
       result.cards.forEach((mult,index)=>after(2220+index*770,()=>{
         setRevealed(prev=>prev.includes(index)?prev:[...prev,index]);
         if(mult>=10)setSpotlight(mult===36?'void':'rare');
       }));
       after(5220,()=>{
         setPhase('complete');
         if(result.payout/result.stake>=10)setSpotlight(result.cards.includes(36)?'void':'rare');
       });
     }
   }catch(err){
     const uncertain=!isGuest&&(!(err instanceof ApiError)||err.status>=500);
     if(!uncertain){receipt.current=null;try{localStorage.removeItem(receiptKey);}catch{/* Optional storage. */}}
     if(mounted.current){setRetry(uncertain);setError(errorMessage(err));setPhase('ready');}
   }finally{locked.current=false;}
 }
 const changePrice=(value:string)=>{if(busy||retry)return;setAmount(value);setOpening(null);setPhase('ready');setSpotlight(null);};
 return <section className="card-cases" data-screen="card-cases">
   <header className="card-cases-title"><h1>Rift Packs</h1></header>
   <div className="card-cases-layout">
     <div className={'card-cases-stage '+phase+(spotlightActive?' spotlight-on':'')}>
       <div className="rift-stage-top"><span>4 CARDS</span><small>{showCards?'REVEAL':'READY'}</small></div>
       {spotlightActive&&<div className={'rift-spotlight '+spotlight} aria-hidden="true"><div className="rift-event-disc"/><div className="rift-event-orbit"/></div>}
       {showCards&&opening?
         <div className="collectible-grid">{opening.cards.map((mult,index)=><Collectible key={opening.id+'-'+index} mult={mult} index={index} stake={opening.stake} revealed={revealed.includes(index)}/>)}</div>:
         <div className="pack-pedestal">
           <div className="pack-stage-aura" aria-hidden="true"/>
           <div className={'sealed-pack '+pack.toLowerCase()} role="img" aria-label={pack+' sealed Rift Pack'}>
             <div className="pack-crimp top"/><span className="pack-sheen" aria-hidden="true"/>
             <span className="pack-wordmark">BLOCKBET <b>ORIGINALS</b></span>
             <div className="pack-emblem" aria-hidden="true"><span/><span/><span/></div>
             <strong>RIFT</strong><span className="pack-caption">FOUR-CARD EDITION</span>
             <span className="pack-tier">{pack.toUpperCase()}</span><div className="pack-crimp bottom"/>
           </div>
         </div>}
       <div className="pack-status" role="status" aria-live="polite">
         {phase==='requesting'?'Securing your draw…':
           phase==='tearing'?'Unsealing your pack…':
           phase==='dealing'?'Dealing four cards in order…':
           phase==='revealing'?'Revealing card '+Math.min(revealed.length+1,4)+' of 4…':
           complete?'All four cards revealed.':'Press Open Pack for an automatic four-card reveal.'}
       </div>
       {complete&&<div className={'rift-result '+(net>0?'positive':net<0?'negative':'even')+(totalMult>=10?' jackpot':'')} role="status">
         <span className="result-kicker">{net>0?'WINNING PACK':net<0?'LOSING PACK':'BREAK EVEN'}</span>
         <strong>{multLabel(totalMult)} <small>total</small></strong>
         <div className="rift-result-meta"><span>Returned <b>{formatUSD(opening!.payout)}</b></span><span>{net>0?'Profit':net<0?'Lost':'Net'} <b>{net>0?'+':net<0?'−':''}{formatUSD(Math.abs(net))}</b></span></div>
       </div>}
     </div>
     <form className="pack-purchase" onSubmit={open}>
       <div className="pack-control-heading"><div><small>OPENING TERMINAL</small><h2>{pack} Rift</h2></div><span>4 CARDS</span></div>
       <p>Four cards per pack. Different designs and returns.</p>
       <label htmlFor="case-price">Bet amount · Play USD</label>
       <div className="pack-price-input"><span>$</span><input id="case-price" inputMode="decimal" type="number" min="1" max="1000000" step="0.01" value={amount} disabled={busy||retry} onChange={e=>changePrice(e.target.value)}/></div>
       <div className="pack-price-actions">
         <button type="button" disabled={busy||retry} onClick={()=>changePrice(String(Math.max(1,Math.round(Number(amount)*50)/100)))}>½</button>
         <button type="button" disabled={busy||retry} onClick={()=>changePrice(String(Math.max(1,Math.min(1_000_000,balance/100,Math.round(Number(amount)*200)/100))))}>2×</button>
       </div>
       <p className="pack-balance">Available balance <strong>{formatUSD(balance)}</strong></p>
       <button type="submit" className="pack-buy" disabled={busy||!isGuest&&!walletReady}>{phase==='requesting'?'Securing…':busy?'Opening…':retry?'Recover opening':complete?'Open another pack':'Open Pack'}</button>
       {error&&<p role="alert" className="form-error">{error}</p>}
       <div className="pack-purchase-meta"><span>98% BASE RTP</span><span>RANDOMISED DROPS</span></div>
       <p className="pack-economy">Wins and losses are based on the combined return from all four cards. Opening deducts the full stake; losing packs return less than the stake. The result is settled once before the animation. Fictional Play USD only.</p>
     </form>
   </div>
   <details className="pack-probabilities">
     <summary>View exact drop probabilities</summary>
     <p>Each row is a possible four-card pack. Each number is that card's payout multiplier of the full stake; the four are added together. The pack's theme is cosmetic, and never changes the odds.</p>
     <div className="pack-odds-rows">{CARD_BUNDLES.map((bundle,i)=>{
       const total=bundle.cards.reduce((sum,m)=>sum+m,0);
       return <div key={i}><span>{bundle.cards.map(multLabel).join(' + ')}</span><strong>{multLabel(total)} total</strong><small>{(bundle.weight/100).toFixed(2)}%</small></div>;
     })}</div>
     <p>Weighted base return: 98%. Rakeback: 0.2% of the pack price, giving a 98.2% theoretical total return. Each multiplier uses its own original card image, from plain commons to full-art rares.</p>
   </details>
 </section>;
}
