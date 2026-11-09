import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatUSD } from "../lib/money";
type Highlight={id:string;game:string;wager:number;payout:number;at:number};
function safe(row:unknown):row is Highlight{
 if(!row||typeof row!=="object")return false;
 const r=row as Record<string,unknown>;
 return typeof r.id==="string"&&typeof r.game==="string"&&/^[A-Za-z \-]{2,32}$/.test(r.game)&&
 typeof r.wager==="number"&&Number.isSafeInteger(r.wager)&&r.wager>0&&r.wager<=100000000&&
 typeof r.payout==="number"&&Number.isSafeInteger(r.payout)&&r.payout>=0&&r.payout<=1000000000&&
 typeof r.at==="number"&&Number.isFinite(r.at);
}
function urlFor(row:Highlight){
 const url=new URL("/highlight",window.location.origin);
 url.searchParams.set("g",row.game);url.searchParams.set("w",String(row.wager));
 url.searchParams.set("p",String(row.payout));url.searchParams.set("t",String(Math.round(row.at)));
 return url.toString();
}
function Glow({win}:{win:boolean}){return <div aria-hidden="true" className={win?"highlight-confetti":"highlight-confetti muted"}>{Array.from({length:16},(_,i)=><i key={i}/>)}</div>;}
function Recap({row}:{row:Highlight}){
 const multi=(row.payout/row.wager).toFixed(2);
 const win=row.payout>row.wager;
 return <div className={win?"highlight-recap won":"highlight-recap"}>
   <Glow win={win}/>
   <small>BLOCKBET · SHAREABLE DEMO HIGHLIGHT</small>
   <span className="highlight-game">{row.game}</span>
   <strong>{multi}×</strong>
   <span className={win?"highlight-win":"highlight-loss"}>{win?"✦ BIG WIN":"RESULT RECAP"}</span>
   <p>{formatUSD(row.wager)} wager · {formatUSD(row.payout)} paid</p>
   <small>Player-submitted fictional-credit result · not independently verified</small>
 </div>;
}
export function HighlightToast(){
 const [row,setRow]=useState<Highlight|null>(null);
 const [copied,setCopied]=useState(false);
 useEffect(()=>{
  function listener(event:Event){
   const data=(event as CustomEvent<unknown>).detail;
   if(!safe(data)||data.payout<=data.wager)return;
   setRow(data);setCopied(false);
   try{localStorage.setItem("blockbet.last-highlight",JSON.stringify(data));}catch{/* optional */}
  }
  window.addEventListener("blockbet:settled",listener);
  return()=>window.removeEventListener("blockbet:settled",listener);
 },[]);
 if(!row)return null;
 return <aside className="highlight-toast" aria-label="Result highlight" role="status">
   <button type="button" className="highlight-close" onClick={()=>setRow(null)} aria-label="Dismiss result">×</button>
   <strong>✦ {row.game} · {(row.payout/row.wager).toFixed(2)}×</strong>
   <span>You won {formatUSD(row.payout)} in demo credits!</span>
   <div><Link to={urlFor(row).replace(window.location.origin,"")}>Watch highlight</Link>
   <button type="button" onClick={()=>void navigator.clipboard.writeText(urlFor(row)).then(()=>setCopied(true)).catch(()=>setCopied(false))}>{copied?"Copied!":"Copy link"}</button></div>
 </aside>;
}
export function HighlightPage(){
 const params=new URLSearchParams(window.location.search);
 const raw={id:"shared",game:params.get("g")||"",wager:Number(params.get("w")),payout:Number(params.get("p")),at:Number(params.get("t"))};
 const [counter,setCounter]=useState(0);
 const isValid=safe(raw);
 const [copied,setCopied]=useState(false);
 if(!isValid)return <main className="highlight-page"><h1>Result highlight unavailable</h1><p>This link is invalid.</p><Link to="/">Return to BlockBet</Link></main>;
 return <main className="highlight-page">
  <div key={counter} className="highlight-frame"><Recap row={raw}/></div>
  <div className="highlight-buttons">
    <button className="bet-btn" type="button" onClick={()=>setCounter(n=>n+1)}>Replay animation</button>
    <button className="ghost-btn" type="button" onClick={()=>void navigator.clipboard.writeText(window.location.href).then(()=>setCopied(true)).catch(()=>setCopied(false))}>{copied?"Link copied":"Share result"}</button>
    <Link to="/">Back to games</Link>
  </div>
 </main>;
}
