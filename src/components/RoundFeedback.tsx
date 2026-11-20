import {useEffect,useRef,useState} from 'react';
import {formatMult,formatUSD} from '../lib/money';
import {summarizeRound,type RoundSummary} from '../lib/round-result.js';

function ReturnAmount({cents}:{cents:number}){
 const [shown,setShown]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches?cents:0);
 useEffect(()=>{
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setShown(cents);return;}
  let frame=0;const start=performance.now();
  const tick=(now:number)=>{const t=Math.min(1,(now-start)/420);setShown(Math.round(cents*(1-(1-t)**3)));if(t<1)frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[cents]);
 return <span aria-hidden="true">{formatUSD(shown)}</span>;
}
export function RoundFeedback({game}:{game:string}){
 const [round,setRound]=useState<RoundSummary|null>(null);
 const lastId=useRef('');
 useEffect(()=>{
  setRound(null);lastId.current='';
  const settle=(event:Event)=>{
   const result=summarizeRound((event as CustomEvent<unknown>).detail,game);
   if(!result||result.id===lastId.current||document.hidden)return;
   lastId.current=result.id;setRound(result);
  };
  window.addEventListener('blockbet:settled',settle);
  return()=>window.removeEventListener('blockbet:settled',settle);
 },[game]);
 return <header className="round-heading"><h1>{game}</h1>
  <div className="round-feedback-slot" role="status" aria-live="polite" aria-atomic="true">
   {round&&<div key={round.id} className={`round-feedback ${round.outcome}`}>
    <span className="round-feedback-mark" aria-hidden="true">{round.outcome==='profit'?<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>:<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>}</span>
    <div className="round-return"><small>Last round returned</small><strong><ReturnAmount cents={round.returned}/><span className="sr-only">{formatUSD(round.returned)}</span></strong></div>
    <div className="round-net"><span>{round.outcome==='profit'?'Net profit':round.outcome==='even'?'Stake returned':'Net result'}</span><strong>{round.net>0?'+':''}{formatUSD(round.net)}</strong></div>
    <span className="round-multiplier">{formatMult(round.multiplier)}</span>
   </div>}
  </div>
 </header>;
}
