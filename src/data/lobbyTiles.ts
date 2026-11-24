export type LobbyTile = {
  id: string;
  name: string;
  art: string;
  tone: string;
  gameId?: string;
};

/** Originals shown on the lobby. gameId is set only when that game exists. */
export const ORIGINAL_TILES: LobbyTile[] = [
  { id: "dice", name: "Dice", art: "dice", tone: "blue", gameId: "dice" },
  { id: "mines", name: "Mines", art: "mines", tone: "rose", gameId: "mines" },
  { id: "plinko", name: "Plinko", art: "plinko", tone: "violet", gameId: "plinko" },
  { id: "roulette", name: "Roulette", art: "roulette", tone: "amber", gameId: "roulette" },
  { id: "coinflip", name: "Coinflip", art: "coinflip", tone: "sky", gameId: "coinflip" },
  { id: "limbo", name: "Limbo", art: "limbo", tone: "orange", gameId: "limbo" },
  { id: "blackjack", name: "Blackjack", art: "blackjack", tone: "red", gameId: "blackjack" },
  { id: "towers", name: "Towers", art: "towers", tone: "cyan", gameId: "dragon" },
  { id: "slide", name: "Slide", art: "slide", tone: "gold", gameId: "slide" },
  { id: "crash", name: "Crash", art: "crash", tone: "crimson", gameId: "crash" },
  { id: "flight", name: "Flight", art: "flight", tone: "azure" },
  { id: "baccarat", name: "Baccarat", art: "baccarat", tone: "green", gameId: "baccarat" },
  { id: "hilo", name: "Hi-Lo", art: "hilo", tone: "navy", gameId: "hilo" },
  { id: "keno", name: "Keno", art: "keno", tone: "purple", gameId: "keno" },
  { id: "snakes", name: "Snakes", art: "snakes", tone: "lime", gameId: "snakes" },
  { id: "digger", name: "Digger", art: "digger", tone: "teal" },
];

export const CASE_TILES: LobbyTile[] = [
  { id: "cases", name: "Cases", art: "cases", tone: "blue", gameId: "cases" },
  { id: "case-battles", name: "Case Battles", art: "case-battles", tone: "amber", gameId: "case-battles" },
  { id: "packs", name: "Rips", art: "rips", tone: "violet", gameId: "packs" },
];

export const TILE_BORDER: Record<string, string> = {
  blue: "#3b82f6",
  rose: "#fb7185",
  violet: "#a78bfa",
  amber: "#d97706",
  sky: "#38bdf8",
  orange: "#fb923c",
  red: "#f43f5e",
  cyan: "#22d3ee",
  gold: "#eab308",
  crimson: "#ef4444",
  azure: "#38bdf8",
  green: "#34d399",
  navy: "#2563eb",
  purple: "#c084fc",
  lime: "#4ade80",
  teal: "#2dd4bf",
};
