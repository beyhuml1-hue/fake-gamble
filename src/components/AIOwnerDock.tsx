import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import "./ai-owner-dock.css";

type Player={id:string;handle:string;balance?:number};
type ChatMessage={id:string;role:"user"|"assistant";handle:string;body:string;at:number};
type Feed={me:Player;people:Player[];messages:ChatMessage[];rain:{round:number;endsAt:number;joined:boolean;count:number;amount:number};now:number;staging:true};
const ENDPOINT=import.meta.env.VITE_AI_OWNER_STAGING_URL||"http://localhost:8787";
function duration(end:number,now:number){const seconds=Math.max(0,Math.ceil((end-now)/1000));return Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");}
function inText(value:string){return value.replace(/[<>&]/g,"").trim().slice(0,500);}
export function AIOwnerDock(){
 const [open,setOpen]=useState(false);
 const [access,setAccess]=useState("");
 const [adminKey,setAdminKey]=useState("");
 const [demoPlayer,setDemoPlayer]=useState("demo-alex");
 const [feed,setFeed]=useState<Feed|null>(null);
 const [composing,setComposing]=useState("");
 const [privateQuery,setPrivateQuery]=useState("");
 const [privateReply,setPrivateReply]=useState("");
 const [tab,setTab]=useState<"chat"|"owner">("chat");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [now,setNow]=useState(Date.now());
 const [connected,setConnected]=useState(false);
 const listEnd=useRef<HTMLDivElement>(null);
 const polling=useRef(false);
 const headers=useCallback(()=>({
  "content-type":"application/json","x-staging-access":access,"x-staging-admin":adminKey,"x-demo-player":demoPlayer
 }),[access,adminKey,demoPlayer]);
 const fetchFeed=useCallback(async()=>{
  if(!access||polling.current)return;
  polling.current=true;
  try{
   const res=await fetch(ENDPOINT+"/api/feed",{headers:headers(),cache:"no-store"});
   const data=await res.json() as Feed&{error?:string};
   if(!res.ok)throw Error(data.error||"Staging connection failed.");
   setFeed(data);setConnected(true);setError("");
  }catch(e){setConnected(false);setError(e instanceof Error?e.message:"Connection failed");}
  finally{polling.current=false;}
 },[access,headers]);
 useEffect(()=>{
  if(!open||!access)return;
  void fetchFeed();const id=window.setInterval(()=>{if(!document.hidden)void fetchFeed();},3000);
  return()=>clearInterval(id);
 },[open,access,fetchFeed]);
 useEffect(()=>{const i=window.setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(i);},[]);
 useEffect(()=>{if(open&&tab==="chat")listEnd.current?.scrollIntoView({behavior:"smooth",block:"end"});},[feed?.messages.length,tab,open]);
 async function send(url:string,data:unknown){
  setBusy(true);setError("");setNotice("");
  try{
   const res=await fetch(ENDPOINT+url,{method:"POST",headers:headers(),body:JSON.stringify(data)});
   const body=await res.json() as {error?:string;reply?:string;feed?:Feed;result?:unknown};
   if(!res.ok)throw Error(body.error||"Request failed.");
   if(body.feed)setFeed(body.feed);
   else await fetchFeed();
   return body;
  }catch(e){setError(e instanceof Error?e.message:"Action failed.");return null;}
  finally{setBusy(false);}
 }
 const mentions=composing.match(/(?:^|\s)@([\w]*)$/);
 const target=(mentions?.[1]||"").toLowerCase();
 const suggestions=mentions?[{id:"ai",handle:"ai"},...(feed?.people||[])].filter(p=>p.handle.toLowerCase().startsWith(target)).slice(0,6):[];
 function chooseMention(name:string){
  setComposing(value=>value.replace(/(?:^|\s)@[\w]*$/,matched=>(matched.startsWith(" ")?" ":"")+"@"+name+" "));
 }
 function submitMessage(event:FormEvent){
  event.preventDefault();
  const body=inText(composing);
  if(!body||busy)return;
  void send("/api/message",{body}).then(r=>{if(r)setComposing("");});
 }
 function ask(event:FormEvent){
  event.preventDefault();
  const message=inText(privateQuery);if(!message||busy)return;
  void send("/api/ask",{message}).then(r=>{if(r?.reply){setPrivateReply(r.reply);setPrivateQuery("");}});
 }
 return <>
   {!open&&<button type="button" className="ao-dock-launch" aria-label="Open BlockBet AI and chat" aria-expanded="false" onClick={()=>setOpen(true)}>
    <span className="ao-dock-spark">✦</span><span>Chat <small>+ AI Owner</small></span>
   </button>}
   {open&&<aside className="ao-dock" aria-label="BlockBet chat and AI Owner">
      <header className="ao-dock-head"><div><span className="ao-avatar">B</span><span><strong>BlockBet Chat</strong><small>✦ AI Owner · Staging</small></span></div>
        <button type="button" aria-label="Close chat panel" title="Close chat" onClick={()=>setOpen(false)}>×</button>
      </header>
      {!access?<section className="ao-dock-access"><span>🔐</span><h3>Private staging</h3><p>This is isolated from real BlockBet players and balances. Enter the test access token to try it.</p>
        <label>Staging access token<input type="password" autoComplete="off" value={access} onChange={e=>setAccess(e.target.value)} placeholder="Paste access token" /></label>
        <small>Never paste the NanoGPT API key here; that key belongs only on the server.</small>
      </section>:<>
        <section className="ao-rain" aria-label="Rain giveaway">
          <div className="ao-rain-banner"><span className="ao-rain-emoji">☂</span><div><b>{feed?.rain.amount??100} Coin Rain</b>
            <small>{feed?duration(feed.rain.endsAt,now):"—"} left · {feed?.rain.count||0} joined</small></div>
            <button type="button" disabled={!connected||busy||!!feed?.rain.joined||!feed?.rain} onClick={()=>void send("/api/rain/join",{round:feed?.rain.round})}>{feed?.rain.joined?"Joined ✓":"Join rain"}</button>
          </div>
          <small>Every 7 minutes · imaginary staging coins only</small>
        </section>
        <div className="ao-dock-controls"><label>Test as <select value={demoPlayer} onChange={e=>{setDemoPlayer(e.target.value);setFeed(null);}}>{["demo-alex","demo-blair","demo-cleo","demo-dex","demo-erin","demo-finn","demo-gabi","demo-hugo"].map((id,i)=><option value={id} key={id}>{["Player123","LuckyBlair","CleoCoins","DexTheAce","ErinPlays","FinnFlip","GabiGems","HugoRolls"][i]}</option>)}</select></label>
         <span>{feed?.me.balance??0} <small>coins</small></span></div>
        <div className="ao-dock-tabs"><button type="button" className={tab==="chat"?"active":""} onClick={()=>setTab("chat")}>Community</button><button type="button" className={tab==="owner"?"active":""} onClick={()=>setTab("owner")}>✦ Ask AI Owner</button></div>
        {tab==="chat"?<>
          <div className="ao-message-stream" role="log" aria-live="polite">
           {feed?.messages.length?feed.messages.map(m=><article key={m.id} className={"ao-message "+(m.role==="assistant"?"ai":"")}>
             <div className="ao-message-meta"><b>{m.role==="assistant"?"✦ ": "● "}{m.handle}</b><time>{new Date(m.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</time></div>
             <p>{m.body}</p>
           </article>):<p className="ao-dock-empty">No messages yet. Try <b>@ai hi</b> or mention another player.</p>}
           <div ref={listEnd}/>
          </div>
          {suggestions.length>0&&<div className="ao-mention-options" role="listbox">{suggestions.map(p=><button type="button" key={p.id} onClick={()=>chooseMention(p.handle)}>@{p.handle}</button>)}</div>}
          <form className="ao-dock-compose" onSubmit={submitMessage}>
            <input aria-label="Message or @ mention" maxLength={500} placeholder="Message, @Player123 or @ai…" value={composing} onChange={e=>setComposing(e.target.value)}/>
            <button type="submit" disabled={!composing.trim()||busy||!connected} aria-label="Send message">➤</button>
          </form>
        </>:<>
          <div className="ao-owner-chat"><div className="ao-owner-intro"><span>✦</span><h3>BlockBet AI Owner</h3><p>Witty, useful, and only pretending to own the casino. Ask about sample players, winners or support.</p></div>
            {privateReply&&<div className="ao-owner-reply" role="status">{privateReply}</div>}
            <div className="ao-owner-samples">{["What's my balance?","Who won most today?","How does Rain work?"].map(q=><button type="button" key={q} onClick={()=>setPrivateQuery(q)}>{q}</button>)}</div>
          </div>
          <form className="ao-dock-compose" onSubmit={ask}><input aria-label="Ask AI Owner" placeholder="Ask anything about test players…" value={privateQuery} onChange={e=>setPrivateQuery(e.target.value)} maxLength={500}/>
            <button type="submit" disabled={busy||!privateQuery.trim()}>➤</button></form>
          <details className="ao-admin"><summary>Test admin access</summary><label>Admin staging token<input type="password" autoComplete="off" value={adminKey} onChange={e=>setAdminKey(e.target.value)} placeholder="Optional admin token" /></label><p>Admin rights are always verified by the backend.</p></details>
        </>}
        {error&&<p className="ao-dock-error" role="alert">{error}</p>}{notice&&<p className="ao-dock-note">{notice}</p>}
        <footer className="ao-dock-foot"><span className={connected?"ao-connected":"ao-disconnected"}>● {connected?"Connected":"Offline"}</span><span>Imaginary accounts only</span></footer>
      </>}
    </aside>}
 </>;
}
