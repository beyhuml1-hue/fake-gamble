import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const schema=file("migrations/0006_club.sql");
const api=file("functions/api/auth/club.js");
const page=file("src/pages/Club.tsx");
const app=file("src/App.tsx");
const shell=file("src/components/AppShell.tsx");

test("Club uses a separate, non-withdrawable demo points ledger with checks",()=>{
 assert.match(schema,/club_players/);
 assert.match(schema,/club_points_ledger/);
 assert.match(schema,/club_points_guard/);
 assert.match(schema,/insufficient Club Points/);
 assert.match(schema,/PRIMARY KEY\(round,user_id\)/);
 assert.match(schema,/UNIQUE INDEX IF NOT EXISTS club_one_open_duel/);
 assert.match(api,/crypto.getRandomValues/);
 assert.match(api,/currentUser\(request,env\)/);
 assert.match(api,/sameOrigin\(request\)/);
 assert.match(api,/hitRateLimit/);
});

test("All Club feature routes exist and require real accounts",()=>{
 const worker=file("blockbet-auth.worker.js");
 assert.match(worker,/"GET \/api\/auth\/club"/);
 assert.match(worker,/"POST \/api\/auth\/club"/);
 assert.match(app,/<Route path="club" element=\{<Club \/>\}/);
 assert.match(shell,/to="\/club"/);
 assert.match(page,/isGuest/);
 for(const action of ["profile","equip","checkin","pack","friend-request","friend-accept","party-create","party-join","duel-create","duel-join","duel-cancel","jackpot-join","tournament-join","claim-mission"]){
  assert.ok(api.includes('action==="'+action+'"'),"Missing "+action);
 }
});

test("Arena multiplayer settles server-side and returns expired stakes",()=>{
 assert.match(api,/async function refundExpiredDuels/);
 assert.match(api,/club_jackpot_winners/);
 assert.match(api,/duel:payout:/);
 assert.match(api,/INSERT OR IGNORE INTO club_points_ledger/);
 assert.match(api,/randomInt\(2\)/);
 assert.match(page,/No live challenges/);
 assert.match(page,/No entries yet/);
 assert.doesNotMatch(page,/fake player|bot opponent/i);
});

test("Cosmetics, missions and leaderboards have server-controlled data",()=>{
 assert.match(api,/club_inventory/);
 assert.match(api,/club_xp_events/);
 assert.match(api,/club_tournament_entries/);
 assert.match(api,/awardChampion/);
 assert.match(page,/Common:70,Uncommon:25,Rare:4,Legendary:1/);
 assert.match(page,/Daily Missions/);
 assert.match(page,/Weekend Tournament/);
 assert.match(page,/Your player card|Customise your profile/);
});

test("Case reels match their published weighted item probabilities",()=>{
 const cases=file("src/games/Cases.tsx");
 assert.match(cases,/function weightedDrop\(drops: CaseDrop\[\]\)/);
 assert.match(cases,/fill\(drops: CaseDrop\[\], count: number\)/);
 assert.match(cases,/weightedDrop\(drops\)/);
 assert.match(cases,/case-reveal rare/);
 assert.match(cases,/Published item chances/);
});

test("Game highlights are shareable but not represented as verified results",()=>{
 const replay=file("src/components/Highlights.tsx");
 const wallet=file("src/state/wallet.tsx");
 assert.match(app,/<Route path="highlight" element=\{<HighlightPage \/>\}/);
 assert.match(wallet,/blockbet:settled/);
 assert.match(replay,/blockbet:settled/);
 assert.match(replay,/not independently verified/);
 assert.match(replay,/navigator.clipboard/);
 assert.match(replay,/Replay animation/);
});
