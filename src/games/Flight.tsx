import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents, formatMult, formatUSD, payout } from "../lib/money";
import { randInt } from "../lib/random";
import { useWallet } from "../state/wallet";

const duration = 12;
const checkpoints = [2, 3.4, 4.8, 6.2, 7.6, 9];
const runway = { min: 13, max: 22 };
const runwaySpeed = 25;
type Pickup = { time: number; height: number; kind: "gem" | "coin" | "bomb"; collected: boolean };
type FlightState = { time: number; height: number; velocity: number; mult: number; pickups: Pickup[] };

export function Flight() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [stake, setStake] = useState(0);
  const [flight, setFlight] = useState<FlightState>({ time: 0, height: 16, velocity: 0, mult: 1, pickups: [] });
  const [status, setStatus] = useState("Ready");
  const [running, setRunning] = useState(false);
  const active = useRef(false);
  const throttle = useRef(false);
  const frame = useRef(0);
  const cancel = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!active.current || (event.code !== "Space" && event.code !== "ArrowUp")) return;
      if (event.target instanceof HTMLElement && event.target.closest("input,select,textarea")) return;
      event.preventDefault();
      throttle.current = event.type === "keydown";
    };
    const release = () => { throttle.current = false; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", release);
      cancelAnimationFrame(frame.current);
      cancel.current?.();
    };
  }, []);

  function launch() {
    const wager = betCents(amount, balance);
    if (active.current || wager === null || !debit(wager)) return;
    active.current = true;
    throttle.current = false;
    setRunning(true);
    setStake(wager);
    setStatus("In flight");
    let current: FlightState = {
      time: 0, height: 16, velocity: 20, mult: 1,
      pickups: checkpoints.map((time, i) => ({
        time, height: 26 + randInt(46), kind: i === 0 ? "gem" : (["coin", "gem", "bomb"] as const)[randInt(3)], collected: false,
      })),
    };
    let previous = performance.now();
    const settle = (landed: boolean) => {
      if (!active.current) return;
      active.current = false;
      cancel.current = undefined;
      const pay = landed ? credit(payout(wager, current.mult)) : 0;
      record("Flight", wager, pay);
    };
    cancel.current = () => settle(false);
    function animate(now: number) {
      const dt = Math.min((now - previous) / 1000 * speed, 0.05);
      previous = now;
      const time = Math.min(duration, current.time + dt);
      const autoTakeoff = time < 1;
      let velocity = Math.max(-32, Math.min(34, current.velocity + dt * (autoTakeoff || throttle.current ? 38 : -35)));
      let height = Math.min(93, current.height + velocity * dt);
      if (height === 93) velocity = 0;
      let mult = current.mult;
      const pickups = current.pickups.map(item => {
        if (item.collected || Math.abs(item.time - time) > 0.16 || Math.abs(item.height - height) > 9) return item;
        if (item.kind === "bomb") {
          height -= 9;
          velocity = -27;
          mult = Math.max(1, mult - 0.35);
        } else {
          height = Math.min(93, height + (item.kind === "gem" ? 9 : 5));
          velocity = Math.max(velocity, 12);
          mult += item.kind === "gem" ? 0.75 : 0.4;
        }
        return { ...item, collected: true };
      });
      current = { time, height, velocity, mult, pickups };
      setFlight(current);
      if (height <= 5 || time === duration) {
        const landed = time === duration && height >= runway.min && height <= runway.max && Math.abs(velocity) <= runwaySpeed;
        settle(landed);
        setRunning(false);
        setStatus(landed ? "Perfect landing" : height <= 5 ? "Crashed before the runway" : "Missed the landing zone");
        return;
      }
      frame.current = requestAnimationFrame(animate);
    }
    setFlight(current);
    frame.current = requestAnimationFrame(animate);
  }

  return <GameLayout title="Flight" note="Hold thrust to climb. Release to descend into the runway band at the finish."
    panel={<BetPanel amount={amount} onAmount={setAmount} profitCents={0} label={running ? "In flight" : "Take off"}
      onAction={launch} disabled={running} locked={running} showProfit={false}>
      <label className="field">Flight speed<select value={speed} disabled={running} onChange={e => setSpeed(Number(e.target.value))}>
        <option value={1}>1× speed</option><option value={2}>2× speed</option>
      </select></label>
    </BetPanel>}>
    <div className="flight-game">
      <div className="flight-readout"><strong>{formatMult(flight.mult)}</strong><span>Return if landed {formatUSD(payout(stake, flight.mult))}</span></div>
      <div className="flight-sky" aria-hidden="true">
        <span className="flight-runway" style={{bottom: runway.min + "%", height: (runway.max - runway.min) + "%"}}>Finish</span>
        {flight.pickups.filter(item => !item.collected).map(item => <span key={item.time} className={"flight-pickup " + item.kind}
          style={{left: (8 + item.time / duration * 83) + "%", bottom: item.height + "%"}}>{item.kind === "gem" ? "◆" : item.kind === "coin" ? "●" : "✹"}</span>)}
        <span className="flight-plane" style={{left: (8 + flight.time / duration * 83) + "%", bottom: Math.max(5, flight.height) + "%",
          rotate: (-flight.velocity / 2) + "deg"}}>✈</span>
      </div>
      <div className="flight-readout"><span role="status">{status}</span><span>{Math.max(0, duration - flight.time).toFixed(1)}s to finish</span></div>
      <button type="button" className="bet-btn flight-thrust" disabled={!running} onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        throttle.current = true;
      }} onLostPointerCapture={() => { throttle.current = false; }}
        onPointerUp={() => { throttle.current = false; }} onPointerCancel={() => { throttle.current = false; }}>Hold to climb</button>
      <p>Space or ↑ to climb. Gems and coins lift the plane. Bombs knock it down. Slow down inside the finish band.</p>
    </div>
  </GameLayout>;
}
