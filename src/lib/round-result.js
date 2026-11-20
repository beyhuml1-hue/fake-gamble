export function summarizeRound(value, game) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' ||
      !Number.isSafeInteger(value.wager) || value.wager <= 0 ||
      !Number.isSafeInteger(value.payout) || value.payout < 0) return null;
  const aliases = { Towers: 'Dragon Tower', 'Gem Drop': 'Diamonds' };
  if (value.game !== game && value.game !== aliases[game]) return null;
  const net = value.payout - value.wager;
  return {id:value.id, returned:value.payout, net, multiplier:value.payout/value.wager,
    outcome:net>0?'profit':net===0?'even':'loss'};
}
