/** Uniform float in (0, 1). */
export function random(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0]! + 1) / (2 ** 32 + 1);
}

export function randInt(maxExclusive: number): number {
  return Math.floor(random() * maxExclusive);
}

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    const a = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = a;
  }
  return copy;
}
