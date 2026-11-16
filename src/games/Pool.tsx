import { useEffect, useRef, useState } from "react";

type Ball = { id: number; x: number; y: number; vx: number; vy: number; sunk: boolean };
const W = 700, H = 350, R = 11;
const pockets = [[0,0],[W/2,0],[W,0],[0,H],[W/2,H],[W,H]];
const colors = ["#f8f4df","#FFD64A","#3186ea","#f85845","#a95de2","#fb9f45","#4bcc92","#8d302e","#171918"];
function rack(){
  const balls: Ball[] = [{id:0,x:185,y:175,vx:0,vy:0,sunk:false}];
  const order = [1,9,2,10,8,3,11,4,12,5,6,13,7,14,15];
  for(let row=0;row<5;row++)for(let spot=0;spot<=row;spot++){
    const id=order[balls.length-1]!;
    balls.push({id,x:480+row*20,y:175+(spot-row/2)*23,vx:0,vy:0,sunk:false});
  }
  return balls;
}

function tick(balls:Ball[]) {
  const active = balls.filter(ball=>!ball.sunk);
  for(const ball of active){
    ball.x += ball.vx;
    ball.y += ball.vy;
    if(pockets.some(([x,y])=>Math.hypot(ball.x-x!,ball.y-y!)<23)){
      ball.sunk=true;
      continue;
    }
    if(ball.x<R||ball.x>W-R){ball.x=Math.max(R,Math.min(W-R,ball.x));ball.vx*=-0.83;}
    if(ball.y<R||ball.y>H-R){ball.y=Math.max(R,Math.min(H-R,ball.y));ball.vy*=-0.83;}
    ball.vx*=0.987;
    ball.vy*=0.987;
  }
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
    const a=active[i]!,b=active[j]!;
    if(a.sunk||b.sunk)continue;
    const distance=Math.hypot(b.x-a.x,b.y-a.y);
    if(distance>=2*R||distance===0)continue;
    const nx=(b.x-a.x)/distance,ny=(b.y-a.y)/distance;
    const overlap=(2*R-distance)/2;
    a.x-=nx*overlap;a.y-=ny*overlap;
    b.x+=nx*overlap;b.y+=ny*overlap;
    const impulse=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
    if(impulse<=0)continue;
    a.vx-=impulse*nx;a.vy-=impulse*ny;
    b.vx+=impulse*nx;b.vy+=impulse*ny;
  }
}

export function Pool(){
  const balls=useRef(rack());
  const animation=useRef(0);
  const [display,setDisplay]=useState(()=>rack());
  const [aim,setAim]=useState({x:480,y:175});
  const [power,setPower]=useState(65);
  const [moving,setMoving]=useState(false);
  const [result,setResult]=useState("");
  const [shots,setShots]=useState(0);
  useEffect(()=>()=>cancelAnimationFrame(animation.current),[]);
  function publish(){setDisplay(balls.current.map(ball=>({...ball})));}
  function reset(){
    cancelAnimationFrame(animation.current);
    balls.current=rack();
    publish();
    setAim({x:480,y:175});
    setMoving(false);
    setShots(0);
    setResult("");
  }
  function shoot(){
    if(moving||result)return;
    const cue=balls.current[0]!;
    const angle=Math.atan2(aim.y-cue.y,aim.x-cue.x);
    cue.vx=Math.cos(angle)*power*0.13;
    cue.vy=Math.sin(angle)*power*0.13;
    setMoving(true);
    setShots(shots+1);
    function frame(){
      tick(balls.current);
      tick(balls.current);
      const eight=balls.current.find(ball=>ball.id===8)!;
      if(eight.sunk){
        setResult(!cue.sunk && balls.current.every(ball=>ball.id===0||ball.sunk)?"Rack cleared.":"Eight ball foul · rack lost.");
        publish();
        setMoving(false);
        return;
      }
      if(balls.current.some(ball=>!ball.sunk&&Math.hypot(ball.vx,ball.vy)>0.09)){
        publish();
        animation.current=requestAnimationFrame(frame);
        return;
      }
      for(const ball of balls.current){ball.vx=0;ball.vy=0;}
      if(cue.sunk){
        const spot=[175,110,240,65,285].find(y=>balls.current.every(ball=>ball.sunk||Math.hypot(ball.x-100,ball.y-y)>2*R));
        Object.assign(cue,{x:100,y:spot??175,sunk:false});
      }
      publish();
      setMoving(false);
    }
    animation.current=requestAnimationFrame(frame);
  }
  const cue=display[0]!;
  return <>
    <svg className="pool-table" viewBox="-14 -14 728 378" role="img" aria-label="Pool table. Click or tap to aim."
      onPointerDown={event=>{
        if(moving)return;
        const transform=event.currentTarget.getScreenCTM()?.inverse();
        if(!transform)return;
        const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(transform);
        setAim({x:point.x,y:point.y});
      }}>
      <rect x={0} y={0} width={W} height={H} rx={12} fill="#176048"/>
      {pockets.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={18} fill="#0c1917"/>)}
      {!moving&&!result&&<line x1={cue.x} y1={cue.y} x2={aim.x} y2={aim.y} stroke="#f6f8db" strokeDasharray="6 7"/>}
      {display.filter(ball=>!ball.sunk).map(ball=><g key={ball.id}>
        <circle cx={ball.x} cy={ball.y} r={R} stroke="#1d2e29" strokeWidth={1.2} fill={colors[ball.id>8?ball.id-8:ball.id]}/>
        {!!ball.id&&<><circle cx={ball.x} cy={ball.y} r={7} fill="#fff4df"/><text x={ball.x} y={ball.y+3} textAnchor="middle" fill="#18221d" fontSize={8}>{ball.id}</text></>}
      </g>)}
    </svg>
    <p role="status">{result||(moving?"Balls in motion…":display.filter(ball=>ball.id!==0&&ball.sunk).length+" pocketed · "+shots+" shots")}</p>
    <div className="arcade-moves">
      <label>Power <input type="range" min={15} max={100} value={power} disabled={moving} onChange={e=>setPower(Number(e.target.value))}/></label>
      <button className="ghost-btn" type="button" disabled={moving||Boolean(result)} onClick={shoot}>Shoot</button>
      <button className="ghost-btn" type="button" onClick={reset}>New rack</button>
    </div>
  </>;
}
