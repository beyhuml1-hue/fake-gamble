import type { ComponentType } from "react";
import { Navigate, useParams } from "react-router-dom";
import type { GameId } from "../data/games";
import { gameById } from "../data/games";
import { Baccarat } from "../games/Baccarat";
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
import { Blitz, Snakes } from "../games/CardAndDice";
import { ArcadeRound } from "../games/ArcadeRound";
import { BoardArcade } from "../games/BoardArcade";
import { Wheel } from "../games/Wheel";

import { Flight } from "../games/Flight";
import { Cases } from "../games/Cases";
import { ExtraRound } from "../games/ExtraRound";

const PAGES: Partial<Record<GameId, ComponentType>> = {
  flight: Flight,
  rips: () => <Cases title="Rips" />,
  cases: () => <Cases title="Cases" />,
  digger: () => <ExtraRound kind="digger" />,
  poison: () => <ExtraRound kind="poison" />,
  farmyard: () => <ExtraRound kind="farmyard" />,
  beacon: () => <ExtraRound kind="beacon" />,
  vault: () => <ExtraRound kind="vault" />,
  dice: Dice,
  blitz: Blitz,
  snakes: Snakes,
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
  coinflip: () => <Flip game="Coinflip" />,
  diamonds: Diamonds,
  baccarat: Baccarat,
  pump: Pump,
  packs: Packs,
  upgrader: Upgrader,
  chicken: Chicken,
  darts: Darts,
};

export function Play() {
  const { id } = useParams();
  if (id === "flip") return <Navigate to="/game/coinflip" replace />;
  const game = gameById(id);
  if (!game) return <Navigate to="/" replace />;
  const Page = PAGES[game.id];
  if (Page) return <Page key={game.id} />;
  if (game.id === "chess" || game.id === "connect-four" || game.id === "uno" || game.id === "pool")
    return <BoardArcade key={game.id} game={game.id} />;
  return <ArcadeRound key={game.id} game={game} />;
}
