import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "../blockbet-auth.worker.js";
import { issueSession } from "../functions/_shared/auth.js";

test("chat authenticates requests, Rain splits exactly $10, and transfers are atomic and retryable", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const migrations = new URL("../migrations/", import.meta.url);
    for (const file of readdirSync(migrations).sort()) db.exec(readFileSync(new URL(file, migrations), "utf8"));
    function statement(query, values = []) {
      const bindings = Object.fromEntries(values.map((value, index) => [String(index + 1), value]));
      return {
        bind: (...next) => statement(query, next),
        async first() { return db.prepare(query).get(bindings); },
        async run() { return { meta: db.prepare(query).run(bindings) }; },
        async execute() {
          const prepared = db.prepare(query);
          return query.startsWith("SELECT")
            ? { results: prepared.all(bindings), meta: { changes: 0 } }
            : { results: [], meta: prepared.run(bindings) };
        },
      };
    }
    const env = { AUTH_PEPPER: "test-only", DB: {
      prepare: statement,
      async batch(statements) {
        db.exec("BEGIN");
        try {
          const results = [];
          for (const s of statements) {
            // D1 batch returns rows from SELECT and changes from mutations.
            results.push(await s.execute());
          }
          db.exec("COMMIT");
          return results;
        } catch (err) {
          db.exec("ROLLBACK");
          throw err;
        }
      },
    } };
    const origin = "https://playblockbet.com";
    const url = origin + "/api/auth/community";
    const cookies = [];
    for (const id of ["alice", "bob", "cam"]) {
      const email = id + "@example.com";
      db.prepare("INSERT INTO auth_users (id,email,created_ms,last_login_ms,password_hash) VALUES (?,?,1,1,'test')").run(id,email);
      cookies.push((await issueSession(env, {id,email})).headers.get("Set-Cookie").split(";")[0]);
    }
    const get = (cookie = "") => worker.fetch(new Request(url, { headers: { cookie } }), env);
    const post = (cookie, data, site = origin) => worker.fetch(new Request(url, {
      method: "POST", headers: { cookie, origin: site, "Content-Type": "application/json" }, body: JSON.stringify(data),
    }), env);
    assert.equal((await get()).status, 401);
    const boards = [];
    for (const cookie of cookies) boards.push(await (await get(cookie)).json());
    const round = boards[0].rain.round;
    const walletUrl = origin + "/api/auth/playusd";
    for (const [index,cookie] of cookies.entries()) {
      const response = await worker.fetch(new Request(walletUrl,{
        method:"POST",headers:{cookie,origin,"Content-Type":"application/json"},
        body:JSON.stringify({action:"initialize",balance:index===0?2000:0})
      }),env);
      assert.equal(response.status,200);
    }
    assert.equal((await post(cookies[0], {action:"join",round:round-1})).status,409);
    assert.equal((await post(cookies[0], {action:"message",body:"Hello"}, "https://other.example")).status,403);
    for (const cookie of cookies) assert.equal((await post(cookie,{action:"join",round})).status,200);
    assert.equal((await post(cookies[0],{action:"join",round})).status,200);
    assert.equal((await (await get(cookies[0])).json()).rain.count,3);
    db.prepare("UPDATE community_rain SET round = ?").run(round-1);
    const totals = [];
    for (const cookie of cookies) {
      const response=await worker.fetch(new Request(walletUrl,{headers:{cookie}}),env);
      totals.push((await response.json()).balance);
    }
    assert.deepEqual(totals,[2334,333,333]);
    assert.equal((await (await get(cookies[0])).json()).profile.cents,undefined);

    assert.equal((await post(cookies[1],{action:"message",body:"Hello"})).status,201);
    const messages = (await (await get(cookies[0])).json()).messages;
    assert.equal(messages[0].playerId,boards[1].profile.id);
    assert.doesNotMatch(JSON.stringify(messages),/@example\.com/);

    const transfer = {action:"transfer",id:crypto.randomUUID(),recipient:boards[1].profile.id,cents:1000};
    assert.equal((await post(cookies[0],transfer)).status,200);
    assert.equal((await post(cookies[0],transfer)).status,200);
    assert.equal((await post(cookies[0],{...transfer,id:crypto.randomUUID()})).status,409);
    const after=[];
    for(const cookie of cookies)after.push((await (await worker.fetch(new Request(walletUrl,{headers:{cookie}}),env)).json()).balance);
    assert.deepEqual(after,[1334,1333,333]);
    assert.equal((await (await get(cookies[1])).json()).profile.cents,undefined);
  } finally {
    db.close();
  }
});
