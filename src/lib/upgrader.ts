export const UPGRADE_EDGE = 0.01;
export const MAX_STACK = 20;

export type UpgradeKind = "coin" | "chip" | "gem" | "card" | "crate";
export type UpgradeItem = { id: string; name: string; kind: UpgradeKind; value: number };

export const UPGRADE_ITEMS: UpgradeItem[] = [
  { id: "clay", name: "Clay Chip", kind: "chip", value: 0.2 },
  { id: "bronze", name: "Bronze Chip", kind: "chip", value: 0.35 },
  { id: "silver", name: "Silver Chip", kind: "chip", value: 0.5 },
  { id: "gold-chip", name: "Gold Chip", kind: "chip", value: 0.75 },
  { id: "lucky", name: "Lucky Coin", kind: "coin", value: 1 },
  { id: "jade", name: "Jade Gem", kind: "gem", value: 1.25 },
  { id: "emerald", name: "Emerald", kind: "gem", value: 1.5 },
  { id: "ruby", name: "Ruby", kind: "gem", value: 2 },
  { id: "sapphire", name: "Sapphire", kind: "gem", value: 2.1 },
  { id: "topaz", name: "Topaz", kind: "gem", value: 2.5 },
  { id: "amethyst", name: "Amethyst", kind: "gem", value: 3 },
  { id: "crown", name: "Crown Card", kind: "card", value: 4 },
  { id: "ace", name: "Ace Card", kind: "card", value: 5 },
  { id: "velvet", name: "Velvet Case", kind: "crate", value: 7.5 },
  { id: "relic", name: "Relic Case", kind: "crate", value: 10 },
  { id: "royal", name: "Royal Crate", kind: "crate", value: 15 },
  { id: "obsidian", name: "Obsidian", kind: "gem", value: 20 },
  { id: "pearl", name: "Pearl", kind: "gem", value: 25 },
  { id: "ingot", name: "Gold Bar", kind: "coin", value: 40 },
  { id: "stack", name: "Coin Stack", kind: "coin", value: 50 },
  { id: "vault", name: "Vault Crate", kind: "crate", value: 75 },
  { id: "trophy", name: "Trophy", kind: "coin", value: 100 },
  { id: "star", name: "Star Gem", kind: "gem", value: 150 },
  { id: "nova", name: "Nova Card", kind: "card", value: 250 },
  { id: "oracle", name: "Oracle Case", kind: "crate", value: 500 },
  { id: "empire", name: "Empire Crate", kind: "crate", value: 1000 },
  { id: "legend", name: "Legend Vault", kind: "crate", value: 2500 },
];

/** Win chance = stake / target item value, minus a small house edge. */
export function upgradeChance(stake: number, target: number, edge = UPGRADE_EDGE): number {
  if (!(stake > 0) || !(target > 0)) return 0;
  return Math.max(0, Math.min(0.99, stake / target - edge));
}

export function upgradeMultiplier(stake: number, target: number): number {
  if (!(stake > 0) || !(target > 0)) return 0;
  return target / stake;
}

export function pickUpgradeTarget(stake: number, multiplier: number, items: UpgradeItem[] = UPGRADE_ITEMS, maxStack = MAX_STACK) {
  const want = Math.max(0.01, stake) * multiplier;
  let best = { index: 0, stack: 1, diff: Number.POSITIVE_INFINITY };
  items.forEach((item, index) => {
    let stack = Math.round(want / item.value);
    if (stack < 1) stack = 1;
    if (stack > maxStack) stack = maxStack;
    const diff = Math.abs(item.value * stack - want);
    if (diff < best.diff) best = { index, stack, diff };
  });
  return best;
}
