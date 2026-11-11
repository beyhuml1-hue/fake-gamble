import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const here=(path)=>readFileSync(new URL(path,import.meta.url));
const text=(path)=>here(path).toString("utf8");

test("Packs difficulties have correctly weighted real payouts and visible odds",()=>{
 const source=text("../src/data/packs.ts");
 const names=["Easy","Medium","Hard","Expert"];
 const returns={};
 for(const name of names){
  const content=source.match(new RegExp("  "+name+":\\[([\\s\\S]*?)\\n  \\]"));
  assert.ok(content,"Missing "+name+" payout table");
  const prizes=[...content[1].matchAll(/\{color:"([a-z]+)",mult:([\d.]+),weight:(\d+)\}/g)]
    .map(x=>({color:x[1],mult:Number(x[2]),weight:Number(x[3])}));
  assert.equal(prizes.length,7,name+" must have seven colours");
  assert.deepEqual(prizes.map(x=>x.color),["slate","cyan","blue","green","red","purple","yellow"]);
  assert.equal(prizes.reduce((sum,x)=>sum+x.weight,0),10000,name+" basis points must total 10,000");
  for(const x of prizes){assert.ok(x.mult>0 && x.weight>0,"Every shown prize must be reachable");}
  const rtp=prizes.reduce((sum,x)=>sum+x.mult*x.weight/10000,0);
  assert.ok(rtp>=.97 && rtp<.99,name+" expected return should be 97%-99%, actual "+rtp);
  const red=prizes.find(x=>x.color==="red");
  assert.ok(red.mult>=4 && red.mult<=7,name+" red prizes should pay 4-7x");
  returns[name]=prizes;
 }
 assert.equal(returns.Expert.at(-1).mult,600,"Expert yellow top prize is exactly 600x");
 assert.equal(returns.Expert.at(-1).weight,10,"Expert yellow is 0.10% and actually possible");
 assert.equal(returns.Medium[1].mult,.3);
 assert.equal(returns.Easy[1].mult,.4);
});

test("Packs spin settles with normal game wallet, blocks repeated bets and shows published odds",()=>{
 const page=text("../src/games/Packs.tsx");
 assert.match(page,/unsettled\.current/);
 assert.match(page,/active\.current/);
 assert.match(page,/debit\(bet\)/);
 assert.match(page,/record\("Packs",due\.stake,due\.pay\)/);
 assert.match(page,/actions\.current\.credit\(due\.pay\)/);
 assert.match(page,/SPIN_MS=3650/);
 assert.match(page,/PACK_LEVELS\.map/);
 assert.match(page,/packRtp\(level\)/);
 assert.match(page,/prize\.weight\/100/);
 assert.match(page,/\/covers\/cover-packs\.webp/);
});

test("Real supplied images are shipped as WebP; successful Mines and Dragon tiles use the green gem",()=>{
 for(const path of ["../public/images/gem-green.webp","../public/covers/cover-packs.webp"]){
  const b=here(path);
  assert.ok(b.length>1000,"No placeholder/missing "+path);
  assert.equal(b.toString("ascii",0,4),"RIFF");
  assert.equal(b.toString("ascii",8,12),"WEBP");
 }
 const mines=text("../src/games/Mines.tsx");
 const tower=text("../src/games/Dragon.tsx");
 assert.match(mines,/className="blockbet-revealed-gem".*gem-green\.webp/);
 assert.match(tower,/className="blockbet-revealed-gem".*gem-green\.webp/);
 assert.match(mines,/bomb \? "💣" : <img/);
 assert.match(tower,/showDragon \? "💣" : showSafe \? <img/);
 const games=text("../src/data/games.ts");
 const play=text("../src/pages/Play.tsx");
 const lobby=text("../src/pages/Lobby.tsx");
 assert.match(games,/id: "packs"/);
 assert.match(play,/packs: Packs/);
 assert.match(lobby,/id === "packs" \? "\/covers\/cover-packs\.webp"/);
 assert.match(text("../functions/api/auth/live-bets.js"),/"Packs"/);
 assert.match(text("../src/styles.css"),/\.blockbet-revealed-gem/);
});
