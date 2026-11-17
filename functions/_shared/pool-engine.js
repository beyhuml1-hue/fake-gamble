// Shared server-side 8-ball simulation. Match outcome never comes from the client.
export const POOL_WIDTH = 700;
export const POOL_HEIGHT = 350;
const R = 11;
const pockets = [[0,0],[350,0],[700,0],[0,350],[350,350],[700,350]];

export function newPoolRack() {
  const balls = [{id:0,x:185,y:175,vx:0,vy:0,sunk:false}];
  const order = [1,9,2,10,8,3,11,4,12,5,6,13,7,14,15];
  for (let row=0;row<5;row++) for (let spot=0;spot<=row;spot++) {
    const id=order[balls.length-1];
    balls.push({id,x:480+row*20,y:175+(spot-row/2)*23,vx:0,vy:0,sunk:false});
  }
  return {balls,shots:0,pocketed:0};
}

function tick(balls) {
  const dt=0.25; // Smaller collision steps keep fast balls from crossing through each other.
  const active=balls.filter(ball=>!ball.sunk);
  for (const ball of active) {
    ball.x+=ball.vx*dt;
    ball.y+=ball.vy*dt;
    if (pockets.some(([x,y])=>Math.hypot(ball.x-x,ball.y-y)<23)) {
      ball.sunk=true;continue;
    }
    if (ball.x<R||ball.x>POOL_WIDTH-R) {
      ball.x=Math.max(R,Math.min(POOL_WIDTH-R,ball.x));ball.vx*=-0.83;
    }
    if (ball.y<R||ball.y>POOL_HEIGHT-R) {
      ball.y=Math.max(R,Math.min(POOL_HEIGHT-R,ball.y));ball.vy*=-0.83;
    }
    ball.vx*=0.987**dt;ball.vy*=0.987**dt;
  }
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++) {
    const a=active[i],b=active[j];
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

export function shootPool(previous, aimX, aimY, power) {
  if (!Number.isFinite(aimX)||!Number.isFinite(aimY)||
      aimX < 0 || aimX > POOL_WIDTH || aimY < 0 || aimY > POOL_HEIGHT ||
      !Number.isInteger(power)||power<15||power>100) return null;
  const balls=previous.balls.map(ball=>({...ball}));
  if (balls.length!==16 || balls.some(b=>!Number.isFinite(b.x)||!Number.isFinite(b.y))) return null;
  const cue=balls.find(ball=>ball.id===0);
  const eight=balls.find(ball=>ball.id===8);
  if (!cue || !eight || cue.sunk || eight.sunk) return null;
  const distance=Math.hypot(aimX-cue.x,aimY-cue.y);
  if(distance<1)return null;
  const angle=Math.atan2(aimY-cue.y,aimX-cue.x);
  cue.vx=Math.cos(angle)*power*0.24;
  cue.vy=Math.sin(angle)*power*0.24;
  const snapshot=()=>balls.flatMap(b=>[Math.round(b.x*100)/100,Math.round(b.y*100)/100,b.sunk?1:0]);
  const replay=[snapshot()];
  for(let frame=0;frame<1400;frame++) {
    for(let substep=0;substep<8;substep++)tick(balls);
    if(frame%2===1)replay.push(snapshot());
    if (balls.every(ball=>ball.sunk||Math.hypot(ball.vx,ball.vy)<=0.09))break;
  }
  replay.push(snapshot());
  for(const ball of balls){ball.vx=0;ball.vy=0;
    ball.x=Number(ball.x.toFixed(2));ball.y=Number(ball.y.toFixed(2));
  }
  const cueFoul=cue.sunk;
  const remaining=balls.filter(ball=>ball.id!==0&&ball.id!==8&&!ball.sunk);
  const potCount=balls.filter(ball=>ball.id!==0&&ball.sunk).length;
  const eightPotted=eight.sunk;
  if(cue.sunk) {
    const spot=[175,110,240,65,285].find(y=>balls.every(ball=>ball.sunk||ball.id===0||Math.hypot(ball.x-100,ball.y-y)>2*R));
    Object.assign(cue,{x:100,y:spot??175,sunk:false});
  }
  const shots=previous.shots+1;
  return {
    state:{balls,shots,pocketed:potCount,replay},
    // A premature eight-ball pocket or scratch on eight loses.
    outcome:eightPotted ? (remaining.length===0&&!cueFoul ? "win" : "loss") : shots>=120 ? "draw" : "next",
    reason:eightPotted ? (remaining.length===0&&!cueFoul?"Eight ball pocketed last.":"Early eight-ball pocket or cue-ball foul.") : cueFoul?"Cue-ball scratch. Opponent's turn.": "Shot complete."
  };
}

