import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Flip uses the site's original gold coin cover art, with heads and tails", () => {
  const flip=readFileSync(new URL("../src/games/Flip.tsx",import.meta.url),"utf8");
  const comp=readFileSync(new URL("../src/components/ReferenceGoldCoin.tsx",import.meta.url),"utf8");
  const style=readFileSync(new URL("../src/styles.css",import.meta.url),"utf8");
  assert.match(flip, /<ReferenceGoldCoin degrees=\{deg\} spinning=\{busy\}/);
  assert.match(comp, /HEADS/);
  assert.match(comp, /TAILS/);
  assert.match(style, /url\("\/covers\/cover-flip\.jpg"\)/);
  assert.match(style, /rotateY\(180deg\)/);
  assert.doesNotMatch(flip, /GoldCoin3D|\/models\/blockbet-gold/);
  assert.doesNotMatch(comp, /model-viewer|\.glb/);
});
