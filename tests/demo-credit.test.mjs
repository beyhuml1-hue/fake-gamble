import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("one-time balance bonus is additive and keyed by a revision", () => {
  const wallet=readFileSync(new URL("../src/state/wallet.tsx",import.meta.url),"utf8");
  const auth=readFileSync(new URL("../functions/_shared/auth.js",import.meta.url),"utf8");
  assert.match(wallet, /adjustment\.mode === "add" \? saved\.balance \+ adjustment\.cents/);
  assert.match(wallet, /adjustment\.revision === saved\.balanceRevision/);
  assert.match(auth, /balance_mode/);
  assert.match(auth, /mode: control\.balance_mode \|\| "set"/);
});
test("admin set balance does not accidentally remain additive", () => {
  const src=readFileSync(new URL("../functions/api/auth/admin.js",import.meta.url),"utf8");
  assert.match(src, /balance_mode = 'set'/);
});
