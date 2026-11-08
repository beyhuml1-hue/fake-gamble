import { random } from "./random";

export const EDGE = 0.01;

export function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let c = 1;
  for (let i = 0; i < kk; i++) c = (c * (n - i)) / (i + 1);
  return c;
}

export function scaleToEdge(weights: number[], probs: number[]): number[] {
  const ev = weights.reduce((sum, weight, i) => sum + weight * (probs[i] ?? 0), 0);
  const factor = ev > 0 ? (1 - EDGE) / ev : 1;
  return weights.map((weight) => Math.round(weight * factor * 100) / 100);
}

export function chanceMultiplier(winChance: number): number {
  return (100 / winChance) * (1 - EDGE);
}

export function crashPoint(): number {
  const r = Math.max(random(), 1e-12);
  return Math.max(1, Math.floor(((1 - EDGE) / r) * 100) / 100);
}

export function limboResult(): number {
  const r = Math.max(random(), 1e-12);
  return Math.max(1, Math.floor(((1 - EDGE) / r) * 100) / 100);
}

export function minesMultiplier(picks: number, mines: number, tiles = 25): number {
  let mult = 1 - EDGE;
  for (let i = 0; i < picks; i++) {
    mult *= (tiles - i) / (tiles - mines - i);
  }
  return mult;
}

export function towerMultiplier(cleared: number, tiles: number, dragons: number): number {
  const safe = tiles - dragons;
  return (1 - EDGE) * (tiles / safe) ** cleared;
}

const KENO_SHAPE: number[][] = [
  [],
  [0, 3.8],
  [0, 1, 9],
  [0, 0, 2.2, 46],
  [0, 0, 1.4, 9, 80],
  [0, 0, 0.5, 3, 18, 180],
  [0, 0, 0, 2, 12, 70, 450],
  [0, 0, 0, 1, 5, 22, 160, 900],
  [0, 0, 0, 0, 3, 14, 70, 320, 1600],
  [0, 0, 0, 0, 2, 7, 32, 160, 900, 3500],
  [0, 0, 0, 0, 0, 4, 16, 80, 360, 1800, 8000],
];

function kenoProbs(picks: number): number[] {
  const denom = comb(40, 10);
  return KENO_SHAPE[picks]!.map((_, hits) => (comb(picks, hits) * comb(40 - picks, 10 - hits)) / denom);
}

export const KENO_PAY: number[][] = KENO_SHAPE.map((row, picks) =>
  picks === 0 ? [] : scaleToEdge(row, kenoProbs(picks)),
);

export function binomialProbs(rows: number): number[] {
  const total = 2 ** rows;
  return Array.from({ length: rows + 1 }, (_, k) => comb(rows, k) / total);
}

function mirror(edgeToCenter: number[]): number[] {
  const center = edgeToCenter[edgeToCenter.length - 1]!;
  const left = edgeToCenter.slice(0, -1);
  return [...left, center, ...left.slice().reverse()];
}

const PLINKO_SHAPE = {
  low: {
    8: [5.6, 2.1, 1.1, 1, 0.5],
    12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2],
    12: [170, 24, 8, 2, 0.7, 0.2, 0.2],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2],
  },
} as const;

export type Risk = keyof typeof PLINKO_SHAPE;
export const PLINKO_ROWS = [8, 12, 16] as const;
export type PlinkoRows = (typeof PLINKO_ROWS)[number];

export const PLINKO: Record<Risk, Record<PlinkoRows, number[]>> = {
  low: { 8: [], 12: [], 16: [] },
  medium: { 8: [], 12: [], 16: [] },
  high: { 8: [], 12: [], 16: [] },
};

(Object.keys(PLINKO_SHAPE) as Risk[]).forEach((risk) => {
  for (const rows of PLINKO_ROWS) {
    const shape = mirror([...PLINKO_SHAPE[risk][rows]]);
    PLINKO[risk][rows] = scaleToEdge(shape, binomialProbs(rows));
  }
});

function scaleEqual(shape: number[]): number[] {
  const probs = shape.map(() => 1 / shape.length);
  return scaleToEdge(shape, probs);
}

export const WHEELS: Record<Risk, number[]> = {
  low: scaleEqual([1.6, 1.3, 1.2, 1.1, 1.2, 0, 1.1, 1.2, 1.3, 1.5]),
  medium: scaleEqual([0, 1.8, 0, 2.4, 0, 1.5, 1.2, 3.2, 0, 2]),
  high: scaleEqual([0, 0, 0, 0, 0, 0, 0, 0, 9, 20]),
};

const DIAMOND_BASE = {
  five: 50,
  four: 8,
  full: 5,
  three: 4,
  twopair: 2,
  pair: 0.1,
  none: 0,
} as const;

export type DiamondHand = keyof typeof DIAMOND_BASE;

export function diamondHand(gems: number[]): DiamondHand {
  const counts = new Map<number, number>();
  for (const gem of gems) counts.set(gem, (counts.get(gem) ?? 0) + 1);
  const parts = [...counts.values()].sort((a, b) => b - a);
  const key = parts.join("");
  if (key === "5") return "five";
  if (key === "41") return "four";
  if (key === "32") return "full";
  if (key.startsWith("3")) return "three";
  if (key.startsWith("22")) return "twopair";
  if (key.startsWith("2")) return "pair";
  return "none";
}

function diamondEv(): number {
  let total = 0;
  let ev = 0;
  const gems: number[] = [];
  const walk = (left: number) => {
    if (left === 0) {
      total += 1;
      ev += DIAMOND_BASE[diamondHand(gems)];
      return;
    }
    for (let g = 0; g < 7; g++) {
      gems.push(g);
      walk(left - 1);
      gems.pop();
    }
  };
  walk(5);
  return ev / total;
}

const diamondFactor = (1 - EDGE) / diamondEv();

export const DIAMOND_PAY: Record<DiamondHand, number> = {
  five: Math.round(DIAMOND_BASE.five * diamondFactor * 100) / 100,
  four: Math.round(DIAMOND_BASE.four * diamondFactor * 100) / 100,
  full: Math.round(DIAMOND_BASE.full * diamondFactor * 100) / 100,
  three: Math.round(DIAMOND_BASE.three * diamondFactor * 100) / 100,
  twopair: Math.round(DIAMOND_BASE.twopair * diamondFactor * 100) / 100,
  pair: Math.round(DIAMOND_BASE.pair * diamondFactor * 100) / 100,
  none: 0,
};

export const DIAMOND_LABEL: Record<DiamondHand, string> = {
  five: "Five of a kind",
  four: "Four of a kind",
  full: "Full house",
  three: "Three of a kind",
  twopair: "Two pair",
  pair: "Pair",
  none: "No win",
};
