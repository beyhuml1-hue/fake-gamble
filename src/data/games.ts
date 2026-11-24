const gameCatalog = [
  { id: "flight", name: "Flight", blurb: "Collect gems and touch down on the runway.", note: "Play USD", gradient: "linear-gradient(150deg,#114e68,#40a290)" },
  { id: "rips", name: "Rips", blurb: "Rip open four cards and reveal their prizes.", note: "Play USD", gradient: "linear-gradient(150deg,#502a71,#9b5579)" },
  { id: "digger", name: "Digger", blurb: "Dig for gems and cash out before your pickaxe breaks.", note: "Play USD", gradient: "linear-gradient(150deg,#203e36,#6a713a)" },
  { id: "poison", name: "Poison", blurb: "Hide a trap and take turns picking with a computer rival.", note: "Play USD", gradient: "linear-gradient(150deg,#48264e,#79743b)" },
  { id: "farmyard", name: "Farmyard Frenzy", blurb: "Spin farm symbols and match a row.", note: "Play USD", gradient: "linear-gradient(150deg,#524923,#8a743c)" },
  { id: "beacon", name: "Beacon Breakout", blurb: "Spin for a row of matching minerals.", note: "Play USD", gradient: "linear-gradient(150deg,#204662,#4a7194)" },
  { id: "vault", name: "Mob Vault", blurb: "Spin for a row of matching mobs.", note: "Play USD", gradient: "linear-gradient(150deg,#3f274e,#875277)" },
  {
    id: "dice",
    name: "Dice",
    blurb: "Roll under or over a line you set.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#2e1064 0%,#6d28d9 55%,#c4b5fd 140%)",
  },
  {
    id: "mines",
    name: "Mines",
    blurb: "Pick gems. Cash out before a mine.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#083344 0%,#0284c7 60%,#7dd3fc 140%)",
  },
  {
    id: "mines-battles",
    name: "Mines Duel",
    blurb: "One shared board. Take turns opening gems.",
    note: "Player vs player",
    gradient: "linear-gradient(160deg,#102b27 0%,#167445 60%,#81edb4 140%)",
  },
  {
    id: "plinko",
    name: "Plinko",
    blurb: "Drop a ball through the pegs.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#451a03 0%,#d97706 55%,#fde68a 140%)",
  },
  {
    id: "crash",
    name: "Crash",
    blurb: "Cash out before the curve breaks.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#450a0a 0%,#dc2626 55%,#fecaca 140%)",
  },
  {
    id: "limbo",
    name: "Limbo",
    blurb: "Set a target. Beat it in one roll.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#022c22 0%,#059669 55%,#a7f3d0 140%)",
  },
  {
    id: "keno",
    name: "Keno",
    blurb: "Pick numbers. Ten are drawn.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#2e1065 0%,#7c3aed 50%,#f0abfc 140%)",
  },
  {
    id: "wheel",
    name: "Wheel",
    blurb: "Spin a ring of multipliers.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#500724 0%,#db2777 55%,#fbcfe8 140%)",
  },
  {
    id: "hilo",
    name: "Hi-Lo",
    blurb: "Guess the next card. Cash out anytime.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#431407 0%,#ea580c 55%,#fed7aa 140%)",
  },
  {
    id: "blackjack",
    name: "Blackjack",
    blurb: "Beat the dealer to 21.",
    note: "3:2 blackjack",
    gradient: "linear-gradient(160deg,#052e16 0%,#16a34a 55%,#bbf7d0 140%)",
  },
  {
    id: "roulette",
    name: "Roulette",
    blurb: "European wheel, single zero.",
    note: "97.30% RTP",
    gradient: "linear-gradient(160deg,#042f2e 0%,#0f766e 55%,#99f6e4 140%)",
  },
  {
    id: "dragon",
    name: "Towers",
    blurb: "Climb the tower, one tile a row.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#1e1b4b 0%,#4f46e5 55%,#c7d2fe 140%)",
  },
  {
    id: "flip",
    name: "Flip",
    blurb: "Call heads or tails.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#422006 0%,#ca8a04 55%,#fef08a 140%)",
  },
  {
    id: "diamonds",
    name: "Gem Drop",
    blurb: "Five gems. Pairs pay.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#0c4a6e 0%,#2563eb 45%,#f472b6 140%)",
  },
  {
    id: "baccarat",
    name: "Baccarat",
    blurb: "Player, banker, or tie.",
    note: "Banker 5% commission",
    gradient: "linear-gradient(160deg,#052e16 0%,#166534 55%,#fde68a 140%)",
  },
  {
    id: "pump",
    name: "Pump",
    blurb: "Inflate the balloon. Cash out before it pops.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#450a0a 0%,#e11d48 55%,#fecdd3 140%)",
  },
  {
    id: "cases",
    name: "Rift Packs",
    blurb: "Open four original arena cards, including the rare 36× void card.",
    note: "98% RTP · Four-card reveal",
    gradient: "linear-gradient(180deg,#0f212e,#1a2c38)",
  },
  {
    id: "packs",
    name: "Packs",
    blurb: "Spin colourful packs for up to 600× in Expert.",
    note: "Weighted multiplier reel",
    gradient: "linear-gradient(160deg,#d4d9e3,#344657)",
  },
  {
    id: "upgrader",
    name: "Upgrader",
    blurb: "Set a multiplier. Land in the green.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#052e16 0%,#16a34a 55%,#fde68a 140%)",
  },
  {
    id: "chicken",
    name: "Chicken Road",
    blurb: "Walk the lanes. Cash out before a car.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#422006 0%,#eab308 55%,#fef9c3 140%)",
  },
  {
    id: "darts",
    name: "Darts",
    blurb: "Throw. Closer to the middle pays more.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#450a0a 0%,#dc2626 55%,#fecaca 140%)",
  },
  { id: "case-battles", name: "Case Battles", blurb: "Open a case against a computer rival.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "coinflip", name: "Coinflip", blurb: "Call heads or tails on a single coin.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "uno", name: "Uno", blurb: "Match cards by color or rank against the computer.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "connect-four", name: "Connect Four", blurb: "Drop four discs in a row against the computer.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "poker", name: "Poker", blurb: "Play a five-card draw showdown.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "pool", name: "8-Ball Pool", blurb: "Aim, set power and pocket the eight ball last.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "chess", name: "Chess", blurb: "Play a full game against the computer.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "floor-is-lava", name: "Floor is Lava", blurb: "Find safe stepping stones and claim your streak.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "draw", name: "Draw", blurb: "Draw to improve cards, then claim them before they bust.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "rps", name: "Rock Paper Scissors", blurb: "Make your move against the computer.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "double", name: "Double", blurb: "Pick red, black, or the rare gold result.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "pig-race", name: "Car Racing", blurb: "Pick a lane and watch the race.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "stocks", name: "Stocks", blurb: "Call the direction of the simulated market.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "slide", name: "Slide", blurb: "Chase a target before the slider reaches its limit.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "blitz", name: "Blitz", blurb: "Draw unique cards without pulling a repeat.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
  { id: "snakes", name: "Snakes", blurb: "Roll two dice and cash out before hitting a snake.", note: "Play USD", gradient: "linear-gradient(160deg,#104735,#092d24)" },
] as const;

export type GameId = (typeof gameCatalog)[number]["id"];

const featured = ["mines", "dragon", "flight", "dice", "plinko", "roulette", "coinflip", "slide",
  "limbo", "blackjack", "crash", "baccarat", "hilo", "keno", "snakes", "digger",
  "poison", "rps", "packs", "rips", "cases", "case-battles", "farmyard", "beacon", "vault"];

export const classic = import.meta.env.MODE === "classic" || /^\/classic(?:\/|$)/.test(window.location.pathname);

export const GAMES = classic
  ? gameCatalog.filter(game => !["flip", "cases", "case-battles", "flight", "rips", "digger",
    "poison", "farmyard", "beacon", "vault"].includes(game.id))
  : featured.map(id => gameCatalog.find(game => game.id === id)!);

export function gameById(id: string | undefined) {
  return GAMES.find(game => game.id === id);
}
