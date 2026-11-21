import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const flip=read('../src/games/Flip.tsx');
const css=read('../src/visual-fixes.css');
test('choosing a side controls the final coin face without autoplay changing the outcome',()=>{
 assert.match(flip,/next === "tails" \? 180 : 0/);
 assert.match(flip,/onClick=\{\(\) => chooseSide\("tails"\)\}/);
 assert.match(css,/\.uiverse-coin-scene\.is-flipping \.uiverse-coin\{transition:transform 1\.7s/);
 assert.doesNotMatch(css,/7s infinite|animation:rotate_4001510/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('win and loss feedback stays tied to actual settled wager values',()=>{
 assert.match(flip,/flip-outcome flip-win/);assert.match(flip,/flip-outcome flip-loss/);
 assert.match(flip,/\(paid \/ lastStake\)\.toFixed\(2\)/);
 assert.match(flip,/LOSS · \$\{formatUSD\(lastStake\)\} wager/);
});
