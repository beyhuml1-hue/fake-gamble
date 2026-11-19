// Four distinct stake multipliers. Weighted base return is exactly 98%.
export const CARD_BUNDLES = [
  { weight: 5000, cards: [0.02, 0.04, 0.08, 0.16] },
  { weight: 3000, cards: [0.05, 0.1, 0.2, 0.4] },
  { weight: 1500, cards: [0.1, 0.2, 0.5, 1.2] },
  { weight: 400, cards: [0.2, 0.4, 1, 3.4] },
  { weight: 100, cards: [0.5, 1, 3, 6] },
];
export function pickBundle(roll) {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new RangeError('Invalid roll');
  let remaining = roll * 10000;
  for (let i = 0; i < CARD_BUNDLES.length; i++) {
    remaining -= CARD_BUNDLES[i].weight;
    if (remaining < 0) return i;
  }
  return CARD_BUNDLES.length - 1;
}
export function casePayout(stake, bundle) {
  return CARD_BUNDLES[bundle].cards.reduce((sum, mult) => sum + Math.round(stake * mult), 0);
}
export function packForPrice(stake) {
  return stake >= 100000 ? 'Obsidian' : stake >= 25000 ? 'Prismatic' : stake >= 5000 ? 'Aurora' : 'Origin';
}
