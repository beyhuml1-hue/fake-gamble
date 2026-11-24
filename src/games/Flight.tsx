import { useEffect, useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents, formatMult, formatUSD, payout } from "../lib/money";
import { randInt, random } from "../lib/random";
import { useWallet } from "../state/wallet";

const duration = 12;
const checkpoints = [2, 3.4, 4.8, 6.2, 7.6, 9];
const runway = { min: 13, max: 22 };
const effects = {
  coin: { lift: 5, multiplier: 0.4 },
  gem: { lift: 9, multiplier: 0.75 },
  bomb: { lift: -13, multiplier: -0.35 },
};
const kinds = ["coin", "gem", "bomb", "bomb"] as const;
type Encounter = { time: number; kind: keyof typeof effects };
type Pickup = Encounter & { height: number };
type FlightState = { time: number; height: number; velocity: number; mult: number; pickups: Pickup[] };

function smooth(value: number) {
  const x = Math.min(1, Math.max(0, value));
  return x * x * (3 - 2 * x);
}

function altitude(time: number, encounters: Encounter[], drift: number) {
  const climb = 46 * smooth(time / 3);
  const descent = 44.5 * smooth((time - 7) / 5);
  const lift = encounters.reduce((height, item) => {
    const elapsed = time - item.time;
    if (elapsed <= 0) return height;
    const strength = smooth(elapsed / 0.45) * (1 - 0.76 * smooth((elapsed - 0.45) / 2.5));
    return height + effects[item.kind].lift * strength;
  }, 0);
  return 16 + climb - descent + drift * smooth((time - 9) / 3) + lift;
}

export function Flight() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [stake, setStake] = useState(0);
  const [flight, setFlight] = useState<FlightState>({ time: 0, height: 16, velocity: 0, mult: 1, pickups: [] });
  const [status, setStatus] = useState("Ready");
  const [running, setRunning] = useState(false);
  const active = useRef(false);
  const frame = useRef(0);
  const settleOnExit = useRef<(() => void) | undefined>(undefined);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    settleOnExit.current?.();
  }, []);

  function launch() {
    const wager = betCents(amount, balance);
    if (active.current || wager === null || !debit(wager)) return;
    active.current = true;
    setRunning(true);
    setStake(wager);
    setStatus("Taking off");

    const encounters = checkpoints.map(time => ({ time, kind: kinds[randInt(kinds.length)] }));
    const drift = (random() - 0.5) * 12;
    const pickups = encounters.map(item => ({ ...item, height: altitude(item.time, encounters, drift) }));
    function sample(time: number): FlightState {
      const height = altitude(time, encounters, drift);
      const previousHeight = altitude(Math.max(0, time - 0.02), encounters, drift);
      const mult = encounters.reduce((value, item) => item.time <= time
        ? Math.max(1, value + effects[item.kind].multiplier) : value, 1);
      return { time, height, velocity: (height - previousHeight) / 0.02, mult,
        pickups: pickups.filter(item => item.time > time) };
    }

    const final = sample(duration);
    const landed = final.height >= runway.min && final.height <= runway.max;
    const settle = () => {
      if (!active.current) return;
      active.current = false;
      settleOnExit.current = undefined;
      const returned = landed ? credit(payout(wager, final.mult)) : 0;
      record("Flight", wager, returned);
    };
    settleOnExit.current = settle;
    const started = performance.now();
    function animate(now: number) {
      const time = Math.min(duration, (now - started) * speed / 1000);
      setFlight(sample(time));
      if (time === duration) {
        settle();
        setRunning(false);
        setStatus(landed ? "Perfect landing" : final.height < runway.min ? "Fell short of the runway" : "Overshot the runway");
        return;
      }
      setStatus(time < 1.5 ? "Taking off" : time >= 9 ? "Final approach" : "In flight");
      frame.current = requestAnimationFrame(animate);
    }
    setFlight(sample(0));
    frame.current = requestAnimationFrame(animate);
  }

  const progress = flight.time / duration;
  const approach = flight.time >= 9;
  const aligned = flight.height >= runway.min && flight.height <= runway.max;
  const potential = flight.time > 0 || running ? stake : betCents(amount, balance) ?? 0;

  return <GameLayout title="Flight" note="The plane flies automatically. Finish inside the landing band to collect the return."
    panel={<BetPanel amount={amount} onAmount={setAmount} profitCents={0} label={running ? "In flight" : "Play"}
      onAction={launch} disabled={running} locked={running} showProfit={false}
      afterAction={<div className="flight-speed" role="group" aria-label="Flight speed">
        {[1, 2].map(rate => <button key={rate} type="button" aria-pressed={speed === rate} disabled={running}
          onClick={() => setSpeed(rate)}>{rate}× speed</button>)}
      </div>}>
    </BetPanel>}>
    <div className="flight-game">
      <div className="flight-sky">
        <div className="flight-readout">
          <dl><div><dt>Multiplier</dt><dd>{formatMult(flight.mult)}</dd></div>
          <div><dt>Return if landed</dt><dd>{formatUSD(payout(potential, flight.mult))}</dd></div></dl>
          <span role="status" className="flight-status">{status}</span>
        </div>
        <div className="flight-scenery" aria-hidden="true">
          <i className="flight-cloud cloud-near" style={{translate: (-75 * progress) + "% 0"}}/>
          <i className="flight-cloud cloud-far" style={{translate: (-130 * progress) + "% 0"}}/>
          <i className="flight-hills"/><i className="flight-water"/>
          <i className="flight-launchpad" style={{left: (1 - 38 * progress) + "%"}}/>
          <span className={"flight-runway" + (approach && aligned ? " aligned" : "")}
            style={{bottom: runway.min + "%", height: (runway.max - runway.min) + "%"}}>Finish</span>
          {flight.pickups.map(item => <span key={item.time} className={"flight-pickup " + item.kind}
            style={{left: (8 + item.time / duration * 83) + "%", bottom: item.height + "%"}}>{item.kind === "gem" ? "◆" : item.kind === "coin" ? "●" : "✹"}</span>)}
          <span className="flight-plane" style={{left: (8 + progress * 83) + "%", bottom: Math.max(5, flight.height) + "%",
            rotate: Math.max(-25, Math.min(25, -flight.velocity / 2)) + "deg"}}><i/><b/><em/></span>
        </div>
        <div className="flight-track">
          <progress aria-label="Flight route progress" value={progress} max={1}/>
          <span>{Math.max(0, duration - flight.time).toFixed(1)}s</span>
        </div>
      </div>
    </div>
  </GameLayout>;
}
