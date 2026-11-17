import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";

const board=readFileSync(new URL("../src/games/BoardArcade.tsx",import.meta.url),"utf8");
const styles=readFileSync(new URL("../src/game-screens.css",import.meta.url),"utf8");

test("Chess and Uno run wallet-backed wagers instead of practice lobbies",()=>{
  assert.doesNotMatch(board,/PracticeBoard|Create practice game|Leave practice game|Create a practice game/);
  assert.match(board,/\? <Multiplayer game=\{game\} \/>/);
  assert.match(board,/: <WagerBoard game=\{game\} \/>/);
  assert.match(board,/betCents\(amount,wallet\.balance\)/);
  assert.match(board,/!wallet\.debit\(stake\)/);
  assert.match(board,/wallet\.record\(name,stake,paid\)/);
  assert.match(board,/result==="win"\?payout\(stake,1\.96\):result==="draw"\?stake:0/);
  assert.match(board,/if\(!stake\)return;/);
  assert.match(board,/locked=\{!playing\}/);
  assert.match(board,/Forfeit · lose stake/);
  assert.match(board,/note="VS Computer · Play USD"/);
});
test("Both computer games settle finished rounds and cannot reset for free",()=>{
  assert.match(board,/if\(ended\) onFinish\(board\.isCheckmate\(\)/);
  assert.match(board,/if\(locked\|\|ended\|\|board\.turn\(\)!=="w"\)return;/);
  assert.match(board,/if\(state\.result\) onFinish\(state\.result==="Draw\."/);
  assert.match(board,/if\(locked\|\|state\.result\)return;/);
  assert.doesNotMatch(board,/>New game<\/button>/);
});
test("Mobile game controls stay ahead of the board without replacing theme",()=>{
  assert.match(styles,/data-play="chess"\] \.game-stage/);
  assert.match(styles,/data-play="uno"\] \.game-stage/);
});
test("Chess engine recognises game-over outcomes used for wallet settlement",()=>{
  const win=new Chess();
  for(const move of ["f3","e5","g4","Qh4#"])win.move(move);
  assert.equal(win.isCheckmate(),true);
  assert.equal(win.turn(),"w");
  const draw=new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assert.equal(draw.isStalemate(),true);
});
