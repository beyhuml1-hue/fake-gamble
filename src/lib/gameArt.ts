const OBJECT_PNG = new Set(["pump", "diamonds", "upgrader"]);
const OBJECTS = new Set([
  "baccarat", "beacon", "blackjack", "case-battles", "cases", "coinflip", "crash",
  "diamonds", "dice", "digger", "dragon", "farmyard", "flight", "hilo", "keno",
  "limbo", "mines", "packs", "plinko", "poison", "pump", "rips", "roulette",
  "rps", "slide", "snakes", "upgrader", "vault",
]);
const COVERS = new Set([
  "baccarat", "blackjack", "cases", "chicken", "crash", "darts", "diamonds",
  "dice", "dragon", "flip", "hilo", "keno", "limbo", "mines", "packs", "plinko",
  "pump", "roulette", "upgrader", "wheel",
]);
const ALIAS: Record<string, string> = { towers: "dragon" };

/** Owner artwork: separated object renders, then the older cover stills. */
export function gameArtUrl(id: string | undefined): string | null {
  if (!id) return null;
  const file = ALIAS[id] ?? id;
  if (OBJECTS.has(file)) return `/covers/arcade/${file}-object.${OBJECT_PNG.has(file) ? "png" : "webp"}`;
  if (COVERS.has(file)) return `/covers/cover-${file}.jpg`;
  return null;
}
