const colors=["red","yellow","green","blue"];
function shuffled(cards){
 for(let i=cards.length-1;i>0;i--){const n=new Uint32Array(1);crypto.getRandomValues(n);const j=n[0]%(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}return cards;
}
export function playable(card,state,hand){
 if(card.value==="wild4")return !hand.some(c=>c.color===state.color);
 return card.color==="wild"||card.color===state.color||card.value===state.top.value;
}
function draw(state,role,count){
 for(let i=0;i<count;i++){
  if(!state.deck.length){state.deck=shuffled(state.discard.splice(0,Math.max(0,state.discard.length-1)));}
  const card=state.deck.pop();if(card)state.hands[role].push(card);
 }
}
// Draw exactly one only when the next player has no legal card. A playable
// drawn card stays in hand; otherwise the turn passes automatically.
function ready(state){
 for(let tries=0;tries<220;tries++){
  const role=state.turn,hand=state.hands[role];
  if(hand.some(c=>playable(c,state,hand)))return;
  draw(state,role,1);state.drawn[role]++;
  if(hand.some(c=>playable(c,state,hand)))return;
  state.turn=role==="host"?"guest":"host";
 }
 state.draw=true;
}
export function newUno(){
 let id=0;const deck=[];
 for(const color of colors)for(let value=0;value<=12;value++)for(let copy=0;copy<(value===0?1:2);copy++)deck.push({id:id++,color,value:String(value<10?value:["skip","reverse","draw2"][value-10])});
 for(let i=0;i<4;i++)for(const value of ["wild","wild4"])deck.push({id:id++,color:"wild",value});
 shuffled(deck);const hands={host:deck.splice(0,7),guest:deck.splice(0,7)};
 const at=deck.findIndex(c=>/^\d$/.test(c.value));const top=deck.splice(at,1)[0];
 const state={deck,hands,top,color:top.color,discard:[top],turn:"host",drawn:{host:0,guest:0},last:null};ready(state);return state;
}
export function playUno(previous,role,move){
 const state=structuredClone(previous);if(state.turn!==role||move?.type!=="play")return null;
 const hand=state.hands[role],at=hand.findIndex(c=>c.id===move.cardId),card=hand[at];
 if(!card||!playable(card,state,hand)||card.color==="wild"&&!colors.includes(move.color))return null;
 hand.splice(at,1);state.top=card;state.discard.push(card);state.color=card.color==="wild"?move.color:card.color;
 state.last={role,card};state.drawn={host:0,guest:0};
 if(!hand.length)return {state,winner:role};
 const other=role==="host"?"guest":"host";
 if(card.value==="draw2"||card.value==="wild4"){
  const count=card.value==="draw2"?2:4;draw(state,other,count);state.drawn[other]+=count;state.turn=role;
 }else state.turn=["skip","reverse"].includes(card.value)?role:other;
 ready(state);return {state,winner:null};
}
export function unoView(state,role){
 return {top:state.top,color:state.color,hand:role?state.hands[role]:[],hostCount:state.hands.host.length,guestCount:state.hands.guest.length,last:state.last,drawn:state.drawn};
}
