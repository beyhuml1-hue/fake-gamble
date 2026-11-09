import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
