import { random } from "../lib/random";

// Weights in basis points, exactly 10,000 per difficulty. Payouts are
// total stake multipliers, not additional profit. Never change the reel
// weights without updating this visible, single source of truth.
export type PackDifficulty="Easy"|"Medium"|"Hard"|"Expert";
export type PackColor="slate"|"cyan"|"blue"|"green"|"red"|"purple"|"yellow";
export type PackPrize={color:PackColor;mult:number;weight:number};
export const PACK_COLORS:PackColor[]=["slate","cyan","blue","green","red","purple","yellow"];
export const PACK_ODDS:Record<PackDifficulty,PackPrize[]>={
  Easy:[
    {color:"slate",mult:0.1,weight:3000},{color:"cyan",mult:0.4,weight:2300},
    {color:"blue",mult:1,weight:2300},{color:"green",mult:1.5,weight:1600},
    {color:"red",mult:4,weight:600},{color:"purple",mult:7,weight:170},
    {color:"yellow",mult:12,weight:30}
  ],
  Medium:[
    {color:"slate",mult:0.1,weight:3800},{color:"cyan",mult:0.3,weight:2700},
    {color:"blue",mult:0.8,weight:1700},{color:"green",mult:1.6,weight:1000},
    {color:"red",mult:5,weight:600},{color:"purple",mult:10,weight:160},
    {color:"yellow",mult:25,weight:40}
  ],
  Hard:[
    {color:"slate",mult:0.1,weight:4990},{color:"cyan",mult:0.25,weight:2400},
    {color:"blue",mult:0.65,weight:1200},{color:"green",mult:1.5,weight:720},
    {color:"red",mult:6,weight:600},{color:"purple",mult:25,weight:80},
    {color:"yellow",mult:120,weight:10}
  ],
  Expert:[
    {color:"slate",mult:0.1,weight:6820},{color:"cyan",mult:0.2,weight:2100},
    {color:"blue",mult:0.4,weight:700},{color:"green",mult:1,weight:170},
    {color:"red",mult:7,weight:170},{color:"purple",mult:35,weight:30},
    {color:"yellow",mult:600,weight:10}
  ]
};
export const PACK_LEVELS:PackDifficulty[]=["Easy","Medium","Hard","Expert"];
export function packRtp(level:PackDifficulty):number{
  return PACK_ODDS[level].reduce((sum,drop)=>sum+drop.mult*drop.weight/10000,0);
}
export function pickPackPrize(level:PackDifficulty,roll=random()):PackPrize{
  let position=Math.max(0,Math.min(0.9999999999,roll))*10000;
  for(const prize of PACK_ODDS[level]){
    position-=prize.weight;
    if(position<0)return prize;
  }
  return PACK_ODDS[level][PACK_ODDS[level].length-1]!;
}
export function packMax(level:PackDifficulty){
  return PACK_ODDS[level][PACK_ODDS[level].length-1]!.mult;
}
