export const CARD_BUNDLES: {weight: number; cards: number[]}[];
export function pickBundle(roll: number): number;
export function casePayout(stake: number, bundle: number): number;
export function packForPrice(stake: number): string;
