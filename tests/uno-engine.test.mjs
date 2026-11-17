import test from "node:test";
import assert from "node:assert/strict";
import {newUno,playUno,unoView,playable} from "../functions/_shared/uno-engine.js";
const card=(id,color,value)=>({id,color,value});
function fixture(){return {top:card(0,"red","5"),color:"red",discard:[card(0,"red","5")],deck:[card(20,"blue","9")],hands:{host:[card(1,"red","2"),card(2,"green","3")],guest:[card(3,"blue","4")]},turn:"host",drawn:{host:0,guest:0}};}
test("Uno keeps hands and deck private, rejects forced draws, illegal cards and wrong turns",()=>{
 const state=newUno(),view=unoView(state,"host");
 assert.equal(view.hand.length,state.hands.host.length);assert.equal(view.deck,undefined);assert.equal(view.hands,undefined);
 assert.equal(unoView(state,null).hand.length,0);
 assert.equal(playUno(state,"guest",{type:"draw"}),null);
 assert.equal(playUno(fixture(),"guest",{type:"play",cardId:3}),null);
 assert.equal(playUno(fixture(),"host",{type:"play",cardId:2}),null);
 assert.equal(playUno(fixture(),"host",{type:"draw"}),null);
});
test("Uno draws only for an unplayable hand and passes automatically if the drawn card cannot play",()=>{
 const state=fixture();state.hands.host.push(card(4,"red","7"));
 const result=playUno(state,"host",{type:"play",cardId:1});
 assert.equal(result.state.drawn.guest,1);assert.equal(result.state.hands.guest.length,2);assert.equal(result.state.turn,"host");
 const other=fixture();other.hands.guest.push(card(5,"red","8"));
 const legal=playUno(other,"host",{type:"play",cardId:1});
 assert.equal(legal.state.drawn.guest,0);assert.equal(legal.state.turn,"guest");
 const drawn=fixture();drawn.deck=[card(22,"red","9")];
 const hit=playUno(drawn,"host",{type:"play",cardId:1});
 assert.equal(hit.state.drawn.guest,1);assert.equal(hit.state.turn,"guest");
});
test("Uno action penalties, wild restrictions and final-card wins are enforced",()=>{
 const state=fixture();state.hands.host=[card(10,"red","draw2"),card(11,"red","3")];state.deck.push(card(21,"yellow","6"));
 const result=playUno(state,"host",{type:"play",cardId:10});
 assert.equal(result.state.hands.guest.length,3);assert.equal(result.state.turn,"host");
 assert.equal(playable(card(15,"wild","wild4"),state,state.hands.host),false);
 state.hands.host=[card(10,"wild","wild")];
 assert.equal(playUno(state,"host",{type:"play",cardId:10,color:"orange"}),null);
 assert.equal(playUno(state,"host",{type:"play",cardId:10,color:"blue"}).winner,"host");
});
