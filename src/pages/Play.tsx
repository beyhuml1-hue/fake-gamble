import type { ComponentType } from "react";
import { Navigate, useParams } from "react-router-dom";
import type { GameId } from "../data/games";
import { gameById } from "../data/games";
import { Blackjack } from "../games/Blackjack";
import { Crash } from "../games/Crash";
import { Diamonds } from "../games/Diamonds";
import { Dice } from "../games/Dice";
import { Dragon } from "../games/Dragon";
import { Flip } from "../games/Flip";
import { Hilo } from "../games/Hilo";
import { Keno } from "../games/Keno";
import { Limbo } from "../games/Limbo";
import { Mines } from "../games/Mines";
import { Plinko } from "../games/Plinko";
import { Roulette } from "../games/Roulette";
import { Wheel } from "../games/Wheel";

const PAGES: Record<GameId, ComponentType> = {
  dice: Dice,
  mines: Mines,
  plinko: Plinko,
  crash: Crash,
  limbo: Limbo,
  keno: Keno,
  wheel: Wheel,
  hilo: Hilo,
  blackjack: Blackjack,
  roulette: Roulette,
  dragon: Dragon,
  flip: Flip,
  diamonds: Diamonds,
};

export function Play() {
  const { id } = useParams();
  const game = gameById(id);
  if (!game) return <Navigate to="/" replace />;
  const Page = PAGES[game.id];
  return <Page />;
}
