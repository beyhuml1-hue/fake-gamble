import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const flip = readFileSync(new URL("../src/games/Flip.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const coin = readFileSync(new URL("../src/components/ReferenceGoldCoin.tsx", import.meta.url), "utf8");

test("Coinflip lets players show both heads and tails before betting", () => {
  assert.match(coin, /<span>HEADS<\/span>/);
  assert.match(coin, /<span>TAILS<\/span>/);
  assert.match(flip, /const chooseSide = \(next: "heads" \| "tails"\)/);
  assert.match(flip, /next === "tails" \? 180 : 0/);
  assert.match(flip, /onClick=\{\(\) => chooseSide\("tails"\)\}/);
  assert.match(css, /\.reference-coin-tails \{ transform: rotateY\(180deg\)/);
  assert.match(css, /\.reference-coin-face span \{[\s\S]*?left: 50%;[\s\S]*?top: 50%;[\s\S]*?translate\(-50%, -50%\)/);
});

test("Coin stays face-on and only spins during a wager", () => {
  assert.match(css, /\.reference-coin-body \{[\s\S]*?transition: none;/);
  // Parent filters force transform-style to flatten, hiding the opposite face.
  const bodyRule = css.match(/\.reference-coin-body \{([^}]+)\}/)?.[1] || "";
  assert.doesNotMatch(bodyRule, /filter\s*:/);
  assert.match(css, /\.reference-coin-scene\.is-flipping \.reference-coin-body \{[\s\S]*?transition: transform 1\.7s/);
  assert.match(coin, /spinning \? "reference-coin-scene is-flipping" : "reference-coin-scene"/);
  assert.match(css, /\/covers\/cover-flip\.jpg/);
});

test("Win and loss animations show the actual demo bet multiplier", () => {
  assert.match(flip, /flip-outcome flip-win/);
  assert.match(flip, /flip-outcome flip-loss/);
  assert.match(flip, /\(paid \/ lastStake\)\.toFixed\(2\)/);
  assert.match(flip, /LOSS · \$\{formatUSD\(lastStake\)\} wager/);
  assert.match(css, /@keyframes flip-win-pop/);
  assert.match(css, /@keyframes flip-loss-shake/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
