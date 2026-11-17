import test from "node:test";
import assert from "node:assert/strict";
import {Chess} from "chess.js";
import {newChess,moveChess} from "../functions/_shared/chess-engine.js";
import {newPoolRack,shootPool} from "../functions/_shared/pool-engine.js";
function position(moves){const chess=new Chess();for(const move of moves)chess.move(move);return {fen:chess.fen(),moves,lastMove:null,check:false};}
test("Chess rejects illegal moves and detects checkmate and repeated-position draws",()=>{
 assert.equal(moveChess(newChess(),{type:"chess",from:"e2",to:"e5"}),null);
 assert.equal(moveChess(newChess(),{type:"chess",from:"e7",to:"e5"}),null);
 assert.equal(moveChess(newChess(),{type:"chess",from:"e2",to:"e4",promotion:"king"}),null);
 const mate=moveChess(position(["f3","e5","g4"]),{type:"chess",from:"d8",to:"h4"});
 assert.equal(mate.finished,true);assert.equal(mate.won,true);assert.equal(mate.state.moves.at(-1),"Qh4#");
 const draw=moveChess(position(["Nf3","Nf6","Ng1","Ng8","Nf3","Nf6","Ng1"]),{type:"chess",from:"f6",to:"g8"});
 assert.equal(draw.finished,true);assert.equal(draw.won,false);assert.match(draw.reason,/repetition/);
});
test("Chess supports castling, en passant and chosen pawn promotions",()=>{
 const castle=moveChess(position(["e4","e5","Nf3","Nc6","Bc4","Nf6"]),{type:"chess",from:"e1",to:"g1"});
 assert.equal(castle.state.moves.at(-1),"O-O");assert.equal(new Chess(castle.state.fen).get('f1').type,'r');
 const ep=moveChess(position(["e4","a6","e5","d5"]),{type:"chess",from:"e5",to:"d6"});
 assert.equal(new Chess(ep.state.fen).get('d5'),undefined);
 const promotion=moveChess(position(["a4","h5","a5","h4","a6","h3","axb7","hxg2"]),{type:"chess",from:"b7",to:"a8",promotion:"n"});
 assert.equal(new Chess(promotion.state.fen).get('a8').type,'n');
});
test("Pool replay captures real physics frames without changing the settled shot",()=>{
 const rack=newPoolRack();const result=shootPool(rack,480,175,65);
 assert.ok(result.state.replay.length>20);assert.ok(result.state.replay.length<=702);
 const first=result.state.replay[0];assert.equal(first.length,48);assert.equal(first[0],rack.balls[0].x);
 assert.ok(result.state.replay.every(frame=>frame.every(Number.isFinite)));
 assert.ok(result.state.replay.some(frame=>frame[0]!==first[0]));
 const final=result.state.replay.at(-1);
 for(let i=1;i<16;i++){assert.equal(final[i*3],result.state.balls[i].x);assert.equal(final[i*3+1],result.state.balls[i].y);}
 assert.equal(rack.shots,0,"The input rack is not mutated");
});
