import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

test("chat text strips tags so markup cannot be treated as HTML", () => {
  const { sanitizeChat, maskName } = evalModule("../src/lib/chatText.ts");
  assert.equal(sanitizeChat("<img src=x onerror=alert(1)>"), "");
  assert.equal(sanitizeChat("hello <b>there</b>"), "hello there");
  assert.equal(sanitizeChat("  safe   message  "), "safe message");
  assert.equal(maskName("Nova"), "No***a");
  const chat = readFileSync(new URL("../src/pages/Community.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(chat, /dangerouslySetInnerHTML/);
  assert.match(chat, /sanitizeChat/);
  assert.match(chat, /Sign in to chat, tip, and join the rain pool\./);
});

test("upgrader chance is stake over target minus the house edge", () => {
  const { upgradeChance, upgradeMultiplier, pickUpgradeTarget } = evalModule("../src/lib/upgrader.ts");
  assert.equal(upgradeChance(1, 2.1).toFixed(4), (1 / 2.1 - 0.01).toFixed(4));
  assert.equal(upgradeChance(0, 2), 0);
  assert.equal(upgradeMultiplier(1, 2.1).toFixed(2), "2.10");
  const pick = pickUpgradeTarget(1, 2);
  assert.ok(pick.stack >= 1);
});

test("rain splits the pool across joined players only", () => {
  const { rainShare } = evalModule("../src/lib/rain.ts");
  assert.equal(rainShare(1000, ["a", "b", "you"], "a"), 334);
  assert.equal(rainShare(1000, ["a", "b", "you"], "you"), 333);
  assert.equal(rainShare(1000, ["a", "b"], "you"), 0);
  assert.equal(rainShare(10, ["you"], "you"), 10);
});

function evalModule(path) {
  const body = load(path);
  const module = { exports: {} };
  new Function("exports", "module", body)(module.exports, module);
  return module.exports;
}
