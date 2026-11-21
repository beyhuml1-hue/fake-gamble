import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('user-supplied thick coin uses readable H and T faces, never Bitcoin artwork',()=>{
 const coin=read('../src/components/ReferenceGoldCoin.tsx');
 assert.match(coin,/>H<\/text>/);assert.match(coin,/>T<\/text>/);
 assert.match(coin,/degrees\+90/);assert.doesNotMatch(coin,/cover-flip|F7931A.*Bitcoin|svg_back/);
 assert.match(read('../src/visual-fixes.css'),/\.uiverse-coin \.tails\{[^}]*rotateY\(90deg\)/);
 assert.match(coin,/JohnnyCSilva/);
});
