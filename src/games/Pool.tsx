import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import "./pool-uno.css";
import { Link } from "react-router-dom";

export type PoolBall = { id: number; x: number; y: number; vx: number; vy: number; sunk: boolean };
const WIDTH = 1000, HEIGHT = 500, RADIUS = 12;
const POCKETS = [[0, 0], [WIDTH / 2, 0], [WIDTH, 0], [0, HEIGHT], [WIDTH / 2, HEIGHT], [WIDTH, HEIGHT]];
const BALL_COLORS = ["#fff8e7", "#f5bc26", "#2058b8", "#cf2936", "#7345a4", "#ea7624", "#197c53", "#81242e", "#202327"];
const STEP = 1 / 240;

export function createPoolRack(): PoolBall[] {
  const balls: PoolBall[] = [{ id: 0, x: 250, y: 250, vx: 0, vy: 0, sunk: false }];
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 6, 13, 7, 14, 15];
  for (let row = 0; row < 5; row++) for (let slot = 0; slot <= row; slot++) {
    balls.push({ id: order[balls.length - 1]!, x: 710 + row * 21.1, y: 250 + (slot - row / 2) * 24.4, vx: 0, vy: 0, sunk: false });
  }
  return balls;
}

/** Fixed, short physics steps prevent fast shots passing through other balls. */
export function advancePool(balls: PoolBall[], seconds: number): number[] {
  const pocketed: number[] = [];
  for (const ball of balls) {
    if (ball.sunk) continue;
    ball.x += ball.vx * seconds;
    ball.y += ball.vy * seconds;
    if (POCKETS.some(([x, y]) => Math.hypot(ball.x - x!, ball.y - y!) < 24)) {
      ball.sunk = true; ball.vx = 0; ball.vy = 0; pocketed.push(ball.id);
      continue;
    }
    if (ball.x < RADIUS || ball.x > WIDTH - RADIUS) {
      ball.x = Math.max(RADIUS, Math.min(WIDTH - RADIUS, ball.x)); ball.vx *= -0.86;
    }
    if (ball.y < RADIUS || ball.y > HEIGHT - RADIUS) {
      ball.y = Math.max(RADIUS, Math.min(HEIGHT - RADIUS, ball.y)); ball.vy *= -0.86;
    }
    const speed = Math.hypot(ball.vx, ball.vy), friction = Math.max(0, speed - 125 * seconds);
    if (speed) { ball.vx *= friction / speed; ball.vy *= friction / speed; }
  }
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    const first = balls[i]!, second = balls[j]!;
    if (first.sunk || second.sunk) continue;
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    if (distance >= RADIUS * 2) continue;
    const nx = distance ? (second.x - first.x) / distance : 1, ny = distance ? (second.y - first.y) / distance : 0;
    const overlap = (RADIUS * 2 - distance) / 2 + 0.001;
    first.x -= nx * overlap; first.y -= ny * overlap; second.x += nx * overlap; second.y += ny * overlap;
    const relativeSpeed = (first.vx - second.vx) * nx + (first.vy - second.vy) * ny;
    if (relativeSpeed <= 0) continue;
    const impulse = relativeSpeed * 0.985;
    first.vx -= impulse * nx; first.vy -= impulse * ny; second.vx += impulse * nx; second.vy += impulse * ny;
  }
  return pocketed;
}

function shotGuide(balls: PoolBall[], angle: number) {
  const cue = balls[0]!, dx = Math.cos(angle), dy = Math.sin(angle);
  let distance = Math.min(dx > 0 ? (WIDTH - RADIUS - cue.x) / dx : dx < 0 ? (RADIUS - cue.x) / dx : Infinity,
    dy > 0 ? (HEIGHT - RADIUS - cue.y) / dy : dy < 0 ? (RADIUS - cue.y) / dy : Infinity);
  let object: PoolBall | undefined;
  for (const ball of balls) {
    if (!ball.id || ball.sunk) continue;
    const x = ball.x - cue.x, y = ball.y - cue.y, along = x * dx + y * dy, across = x * dy - y * dx;
    if (along <= 0 || Math.abs(across) >= RADIUS * 2) continue;
    const hit = along - Math.sqrt((RADIUS * 2) ** 2 - across ** 2);
    if (hit > 0 && hit < distance) { distance = hit; object = ball; }
  }
  return { x: cue.x + dx * distance, y: cue.y + dy * distance, object };
}

export function Pool() {
  const id = useId().replace(/:/g, "");
  const balls = useRef(createPoolRack()), animation = useRef(0), running = useRef(false);
  const [display, setDisplay] = useState(createPoolRack);
  const [angle, setAngle] = useState(0), [power, setPower] = useState(55), [moving, setMoving] = useState(false);
  const [result, setResult] = useState(""), [notice, setNotice] = useState("Aim on the cloth, set your power, then shoot.");
  const [shots, setShots] = useState(0), [potted, setPotted] = useState<number[]>([]);
  useEffect(() => () => { running.current = false; cancelAnimationFrame(animation.current); }, []);
  function publish() { setDisplay(balls.current.map(ball => ({ ...ball }))); }
  function reset() {
    running.current = false; cancelAnimationFrame(animation.current); balls.current = createPoolRack();
    publish(); setAngle(0); setMoving(false); setShots(0); setResult(""); setPotted([]);
    setNotice("Fresh rack. Clear all object balls before the eight.");
  }
  function aim(event: PointerEvent<SVGSVGElement>) {
    if (running.current || result || (event.type === "pointermove" && !event.buttons)) return;
    const matrix = event.currentTarget.getScreenCTM()?.inverse();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix), cue = balls.current[0]!;
    setAngle(Math.atan2(point.y - cue.y, point.x - cue.x));
    if (event.type === "pointerdown") event.currentTarget.setPointerCapture(event.pointerId);
  }
  function shoot() {
    if (running.current || result) return;
    running.current = true;
    const cue = balls.current[0]!;
    cue.vx = Math.cos(angle) * (170 + power * 9.5); cue.vy = Math.sin(angle) * (170 + power * 9.5);
    setMoving(true); setShots(value => value + 1); setNotice("Shot in motion…");
    let last = performance.now(), accumulator = 0, eightLegal = false;
    const sunkThisShot: number[] = [];
    function frame(now: number) {
      if (!running.current) return;
      accumulator += Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      while (accumulator >= STEP) {
        const pocketed = advancePool(balls.current, STEP);
        if (pocketed.includes(8)) eightLegal = balls.current.every(ball => ball.id === 0 || ball.sunk);
        sunkThisShot.push(...pocketed); accumulator -= STEP;
      }
      publish();
      if (balls.current.some(ball => !ball.sunk && Math.hypot(ball.vx, ball.vy) > 0.5)) {
        animation.current = requestAnimationFrame(frame); return;
      }
      running.current = false; setMoving(false);
      for (const ball of balls.current) { ball.vx = 0; ball.vy = 0; }
      setPotted(previous => [...previous, ...sunkThisShot.filter(number => number !== 0)]);
      if (sunkThisShot.includes(8)) setResult(eightLegal && !cue.sunk ? "Rack cleared. The eight was pocketed last." : "Eight-ball foul. Start a new rack.");
      else if (cue.sunk) {
        let found = false;
        for (let x = 140; x < 450 && !found; x += 30) for (let y = 100; y < 420 && !found; y += 30) {
          if (balls.current.every(ball => ball.sunk || Math.hypot(ball.x - x, ball.y - y) > RADIUS * 2 + 1)) {
            Object.assign(cue, { x, y, sunk: false }); found = true;
          }
        }
        setNotice("Scratch. The cue ball has been returned to a clear position.");
      } else setNotice(sunkThisShot.length ? sunkThisShot.length + " pocketed. Line up your next shot." : "No pot. Adjust your aim and try again.");
      publish();
    }
    animation.current = requestAnimationFrame(frame);
  }
  const cue = display[0]!, guide = shotGuide(display, angle), cueDistance = 24 + power * 0.33;
  return <div className="premium-pool">
    <div className="pool-scorebar"><span><b>You</b><small>Solo practice</small></span><div className="pool-pocketed" aria-label="Pocketed balls">
      {potted.map(number => <i key={number} style={{ backgroundColor: BALL_COLORS[number > 8 ? number - 8 : number] }}>{number}</i>)}
    </div><span><b>{shots} shots</b><small>{potted.length} / 15 pocketed</small></span></div>
    <svg className="pool-table premium-pool-table" viewBox="-54 -54 1108 608" role="img" aria-label="Pool table. Drag on the cloth to aim."
      onPointerDown={aim} onPointerMove={aim}>
      <defs>
        <linearGradient id={id + "wood"} x2="0.3" y2="1"><stop stopColor="#9c6940"/><stop offset=".12" stopColor="#4a2415"/><stop offset=".4" stopColor="#815130"/><stop offset=".62" stopColor="#48261a"/><stop offset="1" stopColor="#a66a3d"/></linearGradient>
        <linearGradient id={id + "brass"} x2=".7" y2="1"><stop stopColor="#fff0b1"/><stop offset=".35" stopColor="#bb9650"/><stop offset=".65" stopColor="#59431f"/><stop offset="1" stopColor="#efd48b"/></linearGradient>
        <radialGradient id={id + "felt"}><stop stopColor="#327b63"/><stop offset="1" stopColor="#215543"/></radialGradient>
        <radialGradient id={id + "pocket"}><stop stopColor="#030707"/><stop offset=".78" stopColor="#030606"/><stop offset="1" stopColor="#29322c"/></radialGradient>
        <radialGradient id={id + "shine"} cx=".3" cy=".25" r=".8"><stop stopColor="#ffffff" stopOpacity=".9"/><stop offset=".25" stopColor="#ffffff" stopOpacity=".16"/><stop offset=".6" stopColor="#000000" stopOpacity="0"/><stop offset="1" stopColor="#000000" stopOpacity=".7"/></radialGradient>
        <pattern id={id + "grain"} width="85" height="10" patternUnits="userSpaceOnUse"><path d="M0 2Q35 -1 85 3M0 6Q40 10 85 5M0 9Q38 5 85 10" stroke="#210d08" strokeWidth=".6" fill="none" opacity=".35"/></pattern>
        <pattern id={id + "cloth"} width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0h4M0 2h4" stroke="#d4ffe9" strokeOpacity=".035"/><path d="M0 0v4M2 0v4" stroke="#002814" strokeOpacity=".12"/></pattern>
      </defs>
      <rect x="-47" y="-43" width="1094" height="594" rx="36" fill="#060b09" opacity=".8"/>
      <rect x="-44" y="-44" width="1088" height="588" rx="32" fill={"url(#" + id + "wood)"} stroke="#b58b57" strokeWidth="2"/>
      <rect x="-42" y="-42" width="1084" height="584" rx="30" fill={"url(#" + id + "grain)"}/>
      {[[-44,-44],[1000,-44],[-44,500],[1000,500]].map(([x,y],index)=><rect key={index} x={x} y={y} width="44" height="44" rx="15" fill={"url(#"+id+"brass)"}/>)}
      <rect x="-17" y="-17" width="1034" height="534" rx="18" fill="#123d23" stroke="#102d19" strokeWidth="7"/>
      <rect width={WIDTH} height={HEIGHT} rx="8" fill={"url(#"+id+"felt)"}/>
      <rect width={WIDTH} height={HEIGHT} rx="8" fill={"url(#"+id+"cloth)"}/>
      <path d="M20 -9H480M520 -9H980M20 509H480M520 509H980M-9 25V475M1009 25V475" stroke="#22985a" strokeWidth="12"/>
      <path d="M20 -4H480M520 -4H980M20 504H480M520 504H980" stroke="#0a4b27" strokeWidth="4"/>
      {[125,250,375,625,750,875].flatMap(x=>[-29,529].map(y=><path key={x+"/"+y} d={"M"+x+" "+(y-6)+"l4 6-4 6-4-6z"} fill="#eddaac" stroke="#624725"/>))}
      {[125,250,375].flatMap(y=>[-29,1029].map(x=><path key={x+"/"+y} d={"M"+x+" "+(y-6)+"l4 6-4 6-4-6z"} fill="#eddaac" stroke="#624725"/>))}
      {POCKETS.map(([x,y],index)=><g key={index}><circle cx={x} cy={y} r="26" fill="#040a06" stroke="#54614c" strokeWidth="3"/><circle cx={x} cy={y} r="22" fill={"url(#"+id+"pocket)"}/></g>)}
      {!moving && !result && <g pointerEvents="none">
        <line x1={cue.x} y1={cue.y} x2={guide.x} y2={guide.y} stroke="#e9ffec" strokeOpacity=".65" strokeWidth="1.4" strokeDasharray="6 8"/>
        <circle cx={guide.x} cy={guide.y} r={RADIUS} fill="none" stroke="#ebffec" strokeOpacity=".7"/>
        {guide.object && <line x1={guide.object.x} y1={guide.object.y} x2={guide.object.x+(guide.object.x-guide.x)*3} y2={guide.object.y+(guide.object.y-guide.y)*3} stroke="#e9ffec" strokeOpacity=".45" strokeDasharray="4 5"/>}
        <g transform={"translate("+cue.x+" "+cue.y+") rotate("+(angle*180/Math.PI)+")"}>
          <path d={"M"+(-cueDistance-230)+" -4L"+(-cueDistance)+" -1L"+(-cueDistance)+" 1L"+(-cueDistance-230)+" 4Z"} fill="#dec08b" stroke="#644c2c" strokeWidth=".8"/>
          <path d={"M"+(-cueDistance-230)+" -4v8l85-1.5v-5Z"} fill="#5e3624"/>
          <path d={"M"+(-cueDistance-3)+" -1.2v2.4h4v-2.4Z"} fill="#8fd8e6"/>
        </g>
      </g>}
      {display.filter(ball=>!ball.sunk).map(ball=><g key={ball.id}>
        <ellipse cx={ball.x+2} cy={ball.y+4} rx={RADIUS+1} ry={RADIUS*.8} fill="#00160b" opacity=".5"/>
        <circle cx={ball.x} cy={ball.y} r={RADIUS} fill={BALL_COLORS[ball.id>8?ball.id-8:ball.id]}/>
        {ball.id>8 && <path d={"M"+(ball.x-10.8)+" "+(ball.y-5)+"a12 12 0 0 1 21.6 0v10a12 12 0 0 1-21.6 0Z"} fill="#fff9df"/>}
        {!!ball.id && <><circle cx={ball.x} cy={ball.y} r="6.5" fill="#fff8dd"/><text x={ball.x} y={ball.y+3.2} textAnchor="middle" fill="#17201a" fontSize="9" fontWeight="700" fontFamily="Arial">{ball.id}</text></>}
        <circle cx={ball.x} cy={ball.y} r={RADIUS} fill={"url(#"+id+"shine)"} stroke="#082315" strokeWidth=".5"/>
      </g>)}
    </svg>
    <p className="pool-status" role="status">{result || notice}</p>
    <div className="pool-shot-controls">
      <label>Shot power <input aria-label="Shot power" type="range" min="1" max="100" value={power} disabled={moving} onChange={event=>setPower(Number(event.target.value))}/><b>{power}%</b></label>
      <div className="pool-fine-aim"><button type="button" disabled={moving} aria-label="Aim left" onClick={()=>setAngle(angle-Math.PI/360)}>↶</button><span>Fine aim</span><button type="button" disabled={moving} aria-label="Aim right" onClick={()=>setAngle(angle+Math.PI/360)}>↷</button></div>
      <button className="bet-btn" type="button" disabled={moving||Boolean(result)} onClick={shoot}>{moving?"In motion…":"Shoot"}</button>
      {result && <Link className="ghost-btn" to="/">Back to lobby</Link>}
      <button className="ghost-btn" type="button" onClick={reset}>New rack</button>
    </div>
  </div>;
}
