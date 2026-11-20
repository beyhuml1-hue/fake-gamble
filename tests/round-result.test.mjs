import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRound} from '../src/lib/round-result.js';
const row={id:'round-1',game:'Dice',wager:10000,payout:19600};
test('results distinguish total returned from actual profit and partial losses',()=>{
 assert.deepEqual(summarizeRound(row,'Dice'),{id:'round-1',returned:19600,net:9600,multiplier:1.96,outcome:'profit'});
 assert.equal(summarizeRound({...row,payout:5000},'Dice').outcome,'loss');
 assert.equal(summarizeRound({...row,payout:10000},'Dice').outcome,'even');
 assert.equal(summarizeRound({...row,payout:0},'Dice').net,-10000);
});
test('results reject unrelated games and invalid wallet numbers while handling historic names',()=>{
 assert.equal(summarizeRound(row,'Mines'),null);
 for(const wager of [0,-1,NaN,Infinity,.5])assert.equal(summarizeRound({...row,wager},'Dice'),null);
 assert.equal(summarizeRound({...row,payout:-1},'Dice'),null);
 assert.equal(summarizeRound({...row,game:'Dragon Tower'},'Towers').outcome,'profit');
});
