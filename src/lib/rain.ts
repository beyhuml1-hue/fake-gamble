/** Integer split of a play-money rain pool. Earlier participants receive any leftover cent. */
export function rainShare(poolCents: number, members: readonly string[], id: string): number {
  if (!Number.isSafeInteger(poolCents) || poolCents <= 0) return 0;
  const unique = members.filter((member, index) => members.indexOf(member) === index);
  const index = unique.indexOf(id);
  if (index < 0 || unique.length === 0) return 0;
  const base = Math.floor(poolCents / unique.length);
  const extra = poolCents % unique.length;
  return base + (index < extra ? 1 : 0);
}
