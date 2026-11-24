import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "../blockbet-auth.worker.js";
import { issueSession } from "../functions/_shared/auth.js";

const base = "https://playblockbet.com";
const migrations = new URL("../migrations/", import.meta.url);
const cashierToken = "test_token_for_fixture_only_123456";

function prepare(sql, db, values = []) {
  const insert = () => db.prepare(sql);
  return {
    bind: (...args) => prepare(sql, db, args),
    first: async () => insert().get(...values) ?? null,
    all: async () => ({ results: insert().all(...values) }),
    run: async () => ({ meta: insert().run(...values) }),
    execute: () => /^\s*SELECT/i.test(sql)
      ? { results: insert().all(...values), meta: { changes: 0 } }
      : { results: [], meta: insert().run(...values) },
  };
}

async function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA recursive_triggers=ON");
  for (const file of readdirSync(migrations).filter(file => file.endsWith(".sql")).sort()) {
    db.exec(readFileSync(new URL(file, migrations), "utf8"));
  }
  const env = {
    AUTH_PEPPER: "test-auth-only", DONUT_CASHIER_ENABLED: "true", DONUT_GAMES_ENABLED: "true",
    DONUT_CASHIER_TOKEN: cashierToken,
    DB: {
      prepare: sql => prepare(sql, db),
      batch: async list => {
        db.exec("BEGIN");
        try {
          const results = list.map(statement => statement.execute());
          db.exec("COMMIT");
          return results;
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      },
    },
  };
  const cookies = {};
  for (const id of ["alice", "bob"]) {
    const email = id + "@example.test";
    db.prepare("INSERT INTO auth_users(id,email,created_ms,last_login_ms,password_hash) VALUES(?,?,1,1,'test')").run(id, email);
    cookies[id] = (await issueSession(env, { id, email })).headers.get("Set-Cookie").split(";")[0];
  }
  const call = (path, input, headers) => worker.fetch(new Request(base + "/api/auth/" + path, {
    method: input ? "POST" : "GET",
    headers: { Origin: base, "Content-Type": "application/json", ...headers },
    body: input ? JSON.stringify(input) : undefined,
  }), env);
  return {
    db, env,
    website: (user, path, input, headers) => call(path, input, { Cookie: cookies[user] || "", ...headers }),
    bridge: (input, token = cashierToken) => call("donut-cashier-bridge", input, { Authorization: "Bearer " + token }),
  };
}

test("DSMP verifies exact sender and amount, reserves a withdrawal and settles a game once", async () => {
  const { db, env, bridge, website } = await fixture();
  try {
    const json = async response => {
      const res = await response;
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      return body;
    };
    const post = (action, fields, user = "alice") =>
      website(user, "donut-cashier", { action, id: crypto.randomUUID(), ...fields });
    const receipt = (player, amount, amountText = String(amount), exact = true) => ({
      action: "deposit", id: crypto.randomUUID(), player, amount, exact, observed_at: Date.now(),
      receipt: player + " paid you $ " + amountText,
    });
    const view = () => json(website("alice", "donut-cashier"));
    const heartbeat = { action: "heartbeat", account: "onixxnex998" };
    assert.equal((await view()).enabled, false);
    assert.equal((await post("link", { player: ".Alice" })).status, 503);
    assert.equal((await bridge(heartbeat, "wrong")).status, 401);
    assert.equal((await bridge({ action: "heartbeat", account: "Other" })).status, 403);
    await json(bridge(heartbeat));
    const link = await json(post("link", { player: ".Alice" }));
    const code = link.intent.amount;
    assert.ok(code >= 1 && code <= 100);
    await json(bridge(receipt("Bob", code)));
    await json(bridge(receipt(".Alice", code + 1)));
    assert.equal((await view()).wallet, null);
    const verification = receipt(".Alice", code, code + ".00");
    await json(bridge(verification));
    await json(bridge(verification));
    assert.equal((await view()).wallet.balance, code);
    assert.equal((await post("link", { player: ".Alice" }, "bob")).status, 409);
    assert.equal((await website("alice", "donut-cashier", { action: "deposit", id: crypto.randomUUID(), amount: 750 },
      { Origin: "https://unrelated.example.test" })).status, 403);

    const flushCooldown = () => db.exec("UPDATE donut_cashier_intents SET resolved_at=0 WHERE status='credited'");
    flushCooldown();
    assert.equal((await view()).minimumDeposit, 100_000);
    assert.equal((await post("deposit", { amount: 99_999 })).status, 400);
    await json(post("deposit", { amount: 100_000 }));
    const deposit = receipt(".Alice", 100_000, "100,000");
    await json(bridge(deposit));
    await json(bridge(deposit));
    assert.equal((await view()).wallet.balance, code + 100_000);

    const flip = { amount: 100, pick: "heads", id: crypto.randomUUID(), payout: 999999999 };
    assert.equal((await website("alice", "donut-coinflip", flip)).status, 409);
    db.exec("UPDATE donut_game_reserve SET balance=500 WHERE id=1");
    const round = await json(website("alice", "donut-coinflip", flip));
    assert.equal(round.payout, round.outcome === "heads" ? 200 : 0);
    assert.equal(round.balance, code + 100_000 - 100 + round.payout);
    assert.deepEqual(await json(website("alice", "donut-coinflip", flip)), round);
    assert.equal((await website("alice", "donut-coinflip", { ...flip, amount: 200 })).status, 409);
    assert.equal(db.prepare("SELECT SUM(balance) AS b FROM donut_wallets").get().b
      + db.prepare("SELECT balance FROM donut_game_reserve WHERE id=1").get().balance, code + 100_500);

    await json(post("withdraw", { amount: 200 }));
    assert.equal((await view()).wallet.balance, round.balance - 200);
    const claimRequest = { action: "claim", account: "onixxnex998" };
    const claim = await json(bridge(claimRequest));
    assert.equal(claim.player, ".Alice");
    assert.equal(claim.amount, 200);
    assert.equal((await json(bridge(claimRequest))).id, undefined);
    await json(bridge({ action: "complete", id: claim.id, status: "confirmed" }));
    assert.equal((await view()).withdrawal.status, "confirmed");

    flushCooldown();
    await json(post("deposit", { amount: 100_000 }));
    await json(bridge(receipt(".Alice", 100_000, "100K", false)));
    assert.equal((await view()).intent.status, "review");
    assert.equal((await view()).wallet.balance, round.balance - 200);
    env.DONUT_CASHIER_ENABLED = "false";
    assert.equal((await view()).enabled, false);
  } finally {
    db.close();
  }
});
