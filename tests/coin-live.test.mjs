import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const asset=(name)=>readFileSync(new URL("../public/coin/"+name+".svg",import.meta.url),"utf8");

test("heads and tails are distinct accessible SVG textures for the same coin",()=>{
 const heads=asset("heads"),tails=asset("tails");
 for(const svg of [heads,tails]) {
   assert.match(svg,/<svg/);
   assert.match(svg,/viewBox="0 0 360 360"/);
   assert.match(svg,/#00e701/);
   assert.match(svg,/HEADS|TAILS/);
   assert.match(svg,/id="metal"/);
 }
 assert.match(heads,/HEADS/);
 assert.match(tails,/TAILS/);
 assert.notEqual(heads,tails);
});

test("community bets publish automatically for signed-in players",()=>{
 const wallet=readFileSync(new URL("../src/state/wallet.tsx",import.meta.url),"utf8");
 const api=readFileSync(new URL("../functions/api/auth/live-bets.js",import.meta.url),"utf8");
 assert.doesNotMatch(wallet,/shareLive|live-opt-in/);
 assert.match(wallet,/if \(email !== "phone"\)/);
 assert.match(api,/currentUser\(request,env\)/);
 assert.match(api,/sameOrigin\(request\)/);
 assert.match(api,/auth_live_bets/);
 assert.match(api,/not server-audited/);
});
