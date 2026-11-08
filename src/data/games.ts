export const GAMES = [
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
    name: "Dragon Tower",
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
    name: "Diamonds",
    blurb: "Five gems. Pairs pay.",
    note: "99% RTP",
    gradient: "linear-gradient(160deg,#0c4a6e 0%,#2563eb 45%,#f472b6 140%)",
  },
] as const;

export type GameId = (typeof GAMES)[number]["id"];

export function gameById(id: string | undefined) {
  return GAMES.find((game) => game.id === id);
}
