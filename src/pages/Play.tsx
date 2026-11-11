import type { ComponentType } from "react";
import { Navigate, useParams } from "react-router-dom";
import type { GameId } from "../data/games";
import { gameById } from "../data/games";
import { Baccarat } from "../games/Baccarat";
import { Cases } from "../games/Cases";
import { Packs } from "../games/Packs";
import { Chicken } from "../games/Chicken";
import { Blackjack } from "../games/Blackjack";
import { Crash } from "../games/Crash";
import { Darts } from "../games/Darts";
import { Diamonds } from "../games/Diamonds";
import { Dice } from "../games/Dice";
import { Dragon } from "../games/Dragon";
import { Flip } from "../games/Flip";
import { Hilo } from "../games/Hilo";
import { Keno } from "../games/Keno";
import { Limbo } from "../games/Limbo";
import { Mines } from "../games/Mines";
import { MinesBattles } from "../games/MinesBattles";
import { Plinko } from "../games/Plinko";
import { Pump } from "../games/Pump";
import { Roulette } from "../games/Roulette";
import { Upgrader } from "../games/Upgrader";
import { Wheel } from "../games/Wheel";

const PAGES: Record<GameId, ComponentType> = {
  dice: Dice,
  mines: Mines,
  "mines-battles": MinesBattles,
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
  baccarat: Baccarat,
  pump: Pump,
  cases: Cases,
  packs: Packs,
  upgrader: Upgrader,
  chicken: Chicken,
  darts: Darts,
};

export function Play() {
  const { id } = useParams();
  const game = gameById(id);
  if (!game) return <Navigate to="/" replace />;
  const Page = PAGES[game.id];
  return <Page />;
}
