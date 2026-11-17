import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { EDGE } from "../lib/math";
import { betCents, formatMult, formatUSD, payout } from "../lib/money";
import { random } from "../lib/random";
import { sound } from "../lib/sound";
import { useWallet } from "../state/wallet";
import "./motion-upgrades.css";

const LANES=16;
const DIFFS={
  easy:{label:"Easy",grow:1.18},
  medium:{label:"Medium",grow:1.44},
  hard:{label:"Hard",grow:1.86},
};
type Diff=keyof typeof DIFFS;

export function Chicken(){
  const wallet=useWallet();
  const walletRef=useRef(wallet);
  walletRef.current=wallet;
  const [amount,setAmount]=useState(1);
  const [diff,setDiff]=useState<Diff>("medium");
  const [step,setStep]=useState(0);
  const [stake,setStake]=useState(0);
  const [active,setActive]=useState(false);
  const [dead,setDead]=useState(false);
  const [cashed,setCashed]=useState(false);
  const [error,setError]=useState("");
  const [crossing,setCrossing]=useState(false);
  const [round,setRound]=useState(0);
  const actionLock=useRef(false);
  const timer=useRef(0);
  const actor=useRef<HTMLDivElement>(null);
  const outstanding=useRef<{stake:number;mult:number}|null>(null);
  const grow=DIFFS[diff].grow;
  const survive=1/grow;
  const mult=step? (1-EDGE)*grow**step:1;

  useEffect(()=>()=> {
    window.clearTimeout(timer.current);
    const saved=outstanding.current;
    outstanding.current=null;
    if(saved){
      const paid=walletRef.current.credit(payout(saved.stake,saved.mult));
      walletRef.current.record("Chicken Road",saved.stake,paid);
    }
  },[]);
  useEffect(()=>{
    actor.current?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
  },[step]);

  function finish(pay:number){
    if(!outstanding.current)return;
    const wager=outstanding.current.stake;
    outstanding.current=null;
    const paid=wallet.credit(pay);
    wallet.record("Chicken Road",wager,paid);
    setActive(false);
  }
  function start(){
    if(actionLock.current||outstanding.current)return;
    const wager=betCents(amount,wallet.balance);
    if(wager===null||!wallet.debit(wager)){
      setError("Choose a bet from $0.10 within your balance.");
      return;
    }
    outstanding.current={stake:wager,mult:1};
    setStake(wager);
    setStep(0);
    setDead(false);
    setCashed(false);
    setActive(true);
    setError("");
    setRound(previous=>previous+1);
  }
  function cross(){
    const saved=outstanding.current;
    if(actionLock.current||!saved)return;
    actionLock.current=true;
    setCrossing(true);
    const next=step+1;
    const hit=random()>survive;
    setStep(next);
    if(hit){
      setDead(true);
      sound.bomb();
      finish(0);
    }else{
      saved.mult=(1-EDGE)*grow**next;
      sound.gem();
      if(next===LANES){
        setCashed(true);
        finish(payout(saved.stake,saved.mult));
      }
    }
    timer.current=window.setTimeout(()=>{actionLock.current=false;setCrossing(false);},550);
  }
  function cashout(){
    if(actionLock.current||!outstanding.current||step<1)return;
    sound.cash();
    setCashed(true);
    finish(payout(stake,mult));
  }

  return <GameLayout title="Chicken Road" note="Cross the traffic · cash out any safe step" panel={
    <BetPanel amount={amount} onAmount={setAmount} profitCents={Math.max(0,payout(active?stake:Math.round(amount*100),active?mult:(1-EDGE)*grow)-(active?stake:Math.round(amount*100)))}
      label={crossing?"Crossing…":active?"Cash out "+formatUSD(payout(stake,mult)):"Bet"}
      onAction={active?cashout:start} disabled={crossing||(active&&!step)} cashout={active&&step>0}
      locked={active||crossing} error={error}
      afterAction={<button className="ghost-btn" type="button" disabled={!active||crossing} onClick={cross}>Go →</button>}>
      <label className="field"><span className="field-label">Difficulty</span><select value={diff} disabled={active||crossing}
        onChange={event=>setDiff(event.target.value as Diff)}>{Object.entries(DIFFS).map(([key,item])=><option key={key} value={key}>{item.label}</option>)}</select></label>
    </BetPanel>
  }>
    <div className="chicken-road-world">
      <header><span>{DIFFS[diff].label} traffic</span><b>{formatMult(mult)}</b><span>{step} / {LANES} lanes</span></header>
      <div className="chicken-road-viewport">
        <div className="chicken-highway" style={{"--lanes":LANES+1} as CSSProperties}>
          <div className="highway-curb"><span>START</span></div>
          {Array.from({length:LANES},(_,index)=><div key={index} className={"highway-lane"+(index<step?" crossed":"")}
            style={{"--traffic-duration":(2.2+(index%4)*.4)+"s","--traffic-offset":-(index%5)*.67+"s"} as CSSProperties}>
            <div className="traffic-car" data-color={index%4}><i/><i/><b/><em/></div>
            <div className="traffic-car second" data-color={(index+2)%4}><i/><i/><b/><em/></div>
            <span className="lane-return">{formatMult((1-EDGE)*grow**(index+1))}</span>
            {index<step&&<span className="lane-check">✓</span>}
          </div>)}
          <div ref={actor} key={round} className={"chicken-actor"+(crossing?" hopping":"")+(dead?" hit":"")+(cashed?" safe":"")}
            style={{left:(step*80+40)+"px"}} aria-label={dead?"Chicken hit":"Chicken at lane "+step}>
            <span className="chicken-body"/><span className="chicken-head"/><span className="chicken-eye"/><span className="chicken-beak"/><span className="chicken-comb"/><span className="chicken-feet"/>
          </div>
        </div>
      </div>
      <p role="status" className={"result-line"+(dead?" lose":cashed?" win":"")}>
        {crossing?"Crossing the lane…":dead?"Traffic caught you. Start a new run.":cashed?"Cashed out "+formatMult(mult):active?"Choose Go to cross or cash out your safe steps.":"Place a bet to start the crossing."}
      </p>
    </div>
  </GameLayout>;
}

