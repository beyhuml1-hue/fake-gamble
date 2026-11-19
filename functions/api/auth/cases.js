import {configured,currentUser,json,readBody,sameOrigin,hitRateLimit} from '../../_shared/auth.js';
import {CARD_BUNDLES,casePayout,pickBundle} from '../../_shared/case-cards.js';

export async function onRequestPost({request,env}) {
  if (!sameOrigin(request)) return json({error:'Invalid request origin.'},403);
  if (!configured(env)) return json({error:'Account service unavailable.'},503);
  const user = await currentUser(request,env);
  if (!user) return json({error:'Sign in to open a pack.'},401);
  const input = await readBody(request);
  if (!/^[0-9a-f-]{36}$/i.test(input?.id || '') || !Number.isSafeInteger(input?.stake) || input.stake < 100 || input.stake > 100_000_000)
    return json({error:'Enter a pack price between $1 and $1,000,000.'},400);
  const existing = await env.DB.prepare('SELECT * FROM case_rounds WHERE id=?1').bind(input.id).first();
  if (existing && (existing.user_id !== user.id || existing.stake !== input.stake)) return json({error:'Receipt does not match this opening.'},409);
  if (!existing) {
    if (!await hitRateLimit(env,'case-open:'+user.id,60000,30,Date.now())) return json({error:'Please wait before opening another pack.'},429);
    const values = new Uint32Array(1); crypto.getRandomValues(values);
    const bundle = pickBundle(values[0] / 4294967296);
    const pay = casePayout(input.stake,bundle);
    await env.DB.prepare('INSERT OR IGNORE INTO case_rounds(id,user_id,stake,bundle,payout,at_ms) SELECT ?1,?2,?3,?4,?5,?6 FROM playusd_wallets WHERE user_id=?2 AND initialized=1 AND cents>=?3 AND cents-?3+?5<=9007199254540991')
      .bind(input.id,user.id,input.stake,bundle,pay,Date.now()).run();
  }
  const round = await env.DB.prepare('SELECT * FROM case_rounds WHERE id=?1 AND user_id=?2').bind(input.id,user.id).first();
  if (!round) return json({error:'Not enough Play USD. Refresh your balance and try again.'},409);
  if (round.stake !== input.stake) return json({error:'Receipt does not match this opening.'},409);
  return json({id:round.id,stake:round.stake,bundle:round.bundle,cards:CARD_BUNDLES[round.bundle].cards,payout:round.payout,fictional:true});
}
