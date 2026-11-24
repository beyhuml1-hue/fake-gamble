import { Link, Navigate, useParams } from "react-router-dom";
import { gameById } from "../data/games";
import { DonutCoinflip } from "../games/DonutCoinflip";

export function Play() {
  const { id } = useParams();
  if (id === "flip") return <Navigate to="/game/coinflip" replace />;
  const game = gameById(id);
  if (!game) return <Navigate to="/" replace />;
  if (game.id === "coinflip") return <DonutCoinflip />;
  return <section className="game-page">
    <Link to="/">‹ Games</Link>
    <h1>{game.name}</h1>
    <p>This game is paused until it supports the DonutSMP balance.</p>
  </section>;
}
