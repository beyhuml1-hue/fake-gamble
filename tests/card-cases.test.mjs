import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {CARD_BUNDLES,pickBundle,casePayout,packForPrice} from '../functions/_shared/case-cards.js';
import worker from '../blockbet-auth.worker.js';
import {issueSession,digest} from '../functions/_shared/auth.js';

const dir=new URL('../migrations/',import.meta.url);
function setup(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA recursive_triggers=ON');
 for(const file of readdirSync(dir).sort())db.exec(readFileSync(new URL(file,dir),'utf8'));
 const statement=(sql,values=[])=>{
  const params=Object.fromEntries(values.map((v,i)=>[String(i+1),v]));
  return {bind:(...v)=>statement(sql,v),first:async()=>db.prepare(sql).get(params),
   all:async()=>({results:db.prepare(sql).all(params)}),run:async()=>({meta:db.prepare(sql).run(params)}),
   execute:async()=>/^\s*SELECT/.test(sql)?{results:db.prepare(sql).all(params),meta:{changes:0}}:{results:[],meta:db.prepare(sql).run(params)}};
 };
 const env={AUTH_PEPPER:'case-test',ADMIN_EMAIL:'16laith.beyhum@beechenchill.manp.org.uk',ADMIN_EMAILS:'beyhuml@gmail.com',DB:{prepare:statement,
  async batch(items){db.exec('BEGIN');try{const r=[];for(const item of items)r.push(await item.execute());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}}};
 const cookies={};
 const add=async(id,email)=>{
  db.prepare("INSERT INTO auth_users(id,email,created_ms,last_login_ms,password_hash) VALUES(?,?,1,1,'test')").run(id,email);
  cookies[id]=(await issueSession(env,{id,email})).headers.get('Set-Cookie').split(';')[0];
  db.prepare('INSERT INTO playusd_wallets(user_id,cents,initialized,updated_ms) VALUES(?,100000,1,1)').run(id);
 };
 const post=(id,path,data,origin='https://playblockbet.com')=>worker.fetch(new Request('https://playblockbet.com/api/auth/'+path,{method:'POST',headers:{Cookie:cookies[id]||'',Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)}),env);
 const balance=id=>db.prepare('SELECT cents FROM playusd_wallets WHERE user_id=?').get(id).cents;
 return {db,env,cookies,add,post,balance};
}
test('four distinct cards, full probability coverage, exact 98% base return and price-only wrappers',()=>{
 assert.equal(CARD_BUNDLES.reduce((s,b)=>s+b.weight,0),10000);
 assert.ok(Math.abs(CARD_BUNDLES.reduce((s,b)=>s+b.cards.reduce((x,m)=>x+m,0)*b.weight/10000,0)-.98)<1e-12);
 const counts=Array(5).fill(0);
 for(let i=0;i<10000;i++)counts[pickBundle((i+.5)/10000)]++;
 assert.deepEqual(counts,CARD_BUNDLES.map(b=>b.weight));
 for(const [i,b] of CARD_BUNDLES.entries()){
  assert.equal(b.cards.length,4);assert.equal(new Set(b.cards).size,4);
  assert.equal(casePayout(10000,i),b.cards.reduce((s,m)=>s+Math.round(10000*m),0));
 }
 assert.throws(()=>pickBundle(1));assert.throws(()=>pickBundle(NaN));
 assert.deepEqual([100,5000,25000,100000].map(packForPrice),['Origin','Aurora','Prismatic','Obsidian']);
});
test('server cases settle and reward exactly once; invalid and cross-user receipts cannot debit a wallet',async()=>{
 const s=setup();try{
  await s.add('player','p@example.com');await s.add('owner','beyhuml@gmail.com');await s.add('other','x@example.com');
  const request={id:crypto.randomUUID(),stake:10000};
  const response=await s.post('player','cases',request);assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.cards.length,4);assert.equal(result.payout,casePayout(request.stake,result.bundle));
  assert.equal(s.balance('player'),90000+result.payout+20);
  assert.equal(s.balance('owner'),100180);
  assert.deepEqual(await (await s.post('player','cases',request)).json(),result);
  assert.equal(s.balance('owner'),100180);
  assert.equal((await s.post('other','cases',request)).status,409);
  assert.equal((await s.post('player','cases',{...request,stake:20000})).status,409);
  assert.equal((await s.post('player','cases',{...request,id:crypto.randomUUID(),stake:99})).status,400);
  assert.equal((await s.post('','cases',request)).status,401);
  assert.equal((await s.post('player','cases',{id:crypto.randomUUID(),stake:100000000})).status,409);
  assert.equal((await s.post('player','cases',request,'https://evil.example')).status,403);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM case_rounds').get().n,1);
 }finally{s.db.close();}
});
test('shared owner balances mirror all mutations without a second starter grant; micro rebates accumulate',async()=>{
 const s=setup();try{
  await s.add('gmail','beyhuml@gmail.com');await s.add('player','p@example.com');
  s.db.prepare('UPDATE playusd_wallets SET cents=123456 WHERE user_id=?').run('gmail');
  await s.add('school','16laith.beyhum@beechenchill.manp.org.uk');
  assert.equal(s.balance('school'),123456);assert.equal(s.balance('gmail'),123456);
  for(let i=0;i<5;i++)assert.equal((await s.post('player','playusd',{action:'game',id:crypto.randomUUID(),delta:-100})).status,200);
  assert.equal(s.balance('player'),99501);assert.equal(s.balance('school'),123465);assert.equal(s.balance('gmail'),123465);
  s.db.prepare('UPDATE playusd_wallets SET cents=cents-300 WHERE user_id=?').run('school');
  assert.equal(s.balance('gmail'),123165);
  assert.equal((await s.post('player','admin',{action:'unlock',password:'anything'})).status,403);
  // A signed owner unlock can never authorize an unrelated user.
  const expiry=Date.now()+60000;const token=expiry+'.'+await digest('admin-unlock:player:'+expiry,s.env.AUTH_PEPPER);
  s.cookies.player+='; bb_admin_unlock='+token;
  assert.equal((await s.post('player','admin',{action:'balance',email:'p@example.com',cents:999999})).status,403);
 }finally{s.db.close();}
});
test('requested reset closes escrow, sets every balance to 1000 and cannot run twice',async()=>{
 const s=setup();try{
  await s.add('player','p@example.com');await s.add('owner','beyhuml@gmail.com');
  s.db.exec("DELETE FROM economy_changes; UPDATE playusd_wallets SET cents=123; INSERT INTO pvp_rooms(id,game,host_id,stake_cents,state_json,created_ms,updated_ms) VALUES('test','chess','player',100,'{}',1,1);");
  s.db.exec(readFileSync(new URL('0022_economy_reset.sql',dir),'utf8'));
  assert.equal(s.balance('player'),100000);assert.equal(s.balance('owner'),100000);
  assert.equal(s.db.prepare("SELECT status FROM pvp_rooms WHERE id='test'").get().status,'expired');
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get().n,0);
  assert.equal(s.db.prepare("SELECT cents FROM economy_reset_balances WHERE user_id='player'").get().cents,23);
  s.cookies.player=(await issueSession(s.env,{id:'player',email:'p@example.com'})).headers.get('Set-Cookie').split(';')[0];
  assert.equal((await s.post('player','playusd',{action:'game',id:crypto.randomUUID(),delta:100,generation:1})).status,409);
  assert.equal((await s.post('player','playusd',{action:'game',id:crypto.randomUUID(),delta:100,generation:2})).status,200);
  s.db.exec("UPDATE playusd_wallets SET cents=333 WHERE user_id='player'");
  s.db.exec(readFileSync(new URL('0022_economy_reset.sql',dir),'utf8'));
  assert.equal(s.balance('player'),333);
 }finally{s.db.close();}
});
test('owner account controls set, add, subtract and ban with atomic audited balance changes',async()=>{
 const s=setup();try{
  await s.add('owner','beyhuml@gmail.com');await s.add('player','p@example.com');
  const expires=Date.now()+60000;
  s.cookies.owner+='; bb_admin_unlock='+expires+'.'+await digest('admin-unlock:owner:'+expires,s.env.AUTH_PEPPER);
  for(const [action,cents,expected] of [['balance',12000,12000],['add',3000,15000],['subtract',1000,14000]]){
   const response=await s.post('owner','admin',{action,email:'p@example.com',cents});
   assert.equal(response.status,200);assert.equal(s.balance('player'),expected);
  }
  assert.equal((await s.post('owner','admin',{action:'subtract',email:'p@example.com',cents:999999})).status,409);
  assert.equal(s.balance('player'),14000);assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM admin_account_actions').get().n,3);
  assert.equal((await s.post('owner','admin',{action:'ban',email:'p@example.com'})).status,200);
  assert.equal((await s.post('player','cases',{id:crypto.randomUUID(),stake:100})).status,401);
  assert.equal((await s.post('owner','admin',{action:'unban',email:'p@example.com'})).status,200);
  assert.equal((await s.post('owner','admin',{action:'ban',email:'beyhuml@gmail.com'})).status,400);
 }finally{s.db.close();}
});

test('Rift Packs have real losses, visible 10x+ rewards and the rare matte 36x arena card',()=>{
 const low= CARD_BUNDLES.filter(bundle=>bundle.cards.reduce((sum,m)=>sum+m,0)<1);
 assert.ok(low.reduce((sum,b)=>sum+b.weight,0)>=7500,'Losing packs must be genuinely frequent');
 assert.equal(CARD_BUNDLES.at(-1).weight,10,'36x card odds are 0.10%');
 assert.ok(CARD_BUNDLES.at(-1).cards.includes(36),'Top drop must contain a 36x card');
 assert.ok(CARD_BUNDLES.some(b=>b.cards.reduce((sum,m)=>sum+m,0)>=10),'10x+ celebration must be attainable');
 const page=text('../src/games/Cases.tsx');
 const css=text('../src/games/card-cases.css');
 const games=text('../src/data/games.ts');
 assert.match(page,/Rift Packs/);
 assert.match(page,/setPhase\('dealing'\)/);
 assert.match(page,/setPhase\('revealing'\)/);
 assert.match(page,/setRevealed\(prev=>/);
 assert.match(page,/LOSING PACK/);
 assert.match(page,/void-card/);
 assert.match(css,/\.rift-spotlight\.void/);
 assert.match(css,/\.card-foil/);
 assert.match(games,/name: "Rift Packs"/);
 assert.doesNotMatch(page,/pikachu|eevee|mewtwo|charizard|poke-holo|\/cards\//i);
});
