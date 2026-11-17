import { useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents } from "../lib/money";
import { shuffle } from "../lib/random";
import { luckOn } from "../lib/luck";
import { useWallet } from "../state/wallet";

type Card = { rank: string; suit: string };
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

function shoe(): Card[] {
  const deck: Card[] = [];
  for (let i = 0; i < 6; i++) for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return shuffle(deck);
}

function pip(card: Card) {
  if (card.rank === "A") return 1;
  if (["10", "J", "Q", "K"].includes(card.rank)) return 0;
  return Number(card.rank);
}

function total(cards: Card[]) {
  return cards.reduce((sum, card) => sum + pip(card), 0) % 10;
}

function bankerDraws(banker: number, third: number | null) {
  if (third == null) return banker <= 5;
  if (banker <= 2) return true;
  if (banker === 3) return third !== 8;
  if (banker === 4) return third >= 2 && third <= 7;
  if (banker === 5) return third >= 4 && third <= 7;
  if (banker === 6) return third === 6 || third === 7;
  return false;
}

type Side = "player" | "banker" | "tie";

export function Baccarat() {
  const { balance, debit, credit, record } = useWallet();
  const deck = useRef<Card[]>([]);
  const [amount, setAmount] = useState(1);
  const [side, setSide] = useState<Side>("player");
  const [player, setPlayer] = useState<Card[]>([]);
  const [banker, setBanker] = useState<Card[]>([]);
  const [note, setNote] = useState("Player, banker, or a tie.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const draw = () => {
    if (deck.current.length < 10) deck.current = shoe();
    return deck.current.pop()!;
  };

  const deal = () => {
    const stake = betCents(amount, balance);
    if (stake == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(stake)) return;
    setError("");
    setBusy(true);
    let p: Card[];
    let b: Card[];
    if (luckOn()) {
      const nine: Card = { rank: "9", suit: "♠" };
      const king: Card = { rank: "K", suit: "♥" };
      const queen: Card = { rank: "Q", suit: "♦" };
      const ten: Card = { rank: "10", suit: "♣" };
      if (side === "tie") {
        p = [nine, king];
        b = [
          { rank: "9", suit: "♣" },
          queen,
        ];
      } else if (side === "player") {
        p = [nine, king];
        b = [ten, queen];
      } else {
        b = [nine, king];
        p = [ten, queen];
      }
    } else {
      p = [draw(), draw()];
      b = [draw(), draw()];
    }
    let pt = total(p);
    let bt = total(b);
    if (pt < 8 && bt < 8) {
      let third: number | null = null;
      if (pt <= 5) {
        const card = draw();
        p.push(card);
        third = pip(card);
        pt = total(p);
      }
      if (bankerDraws(bt, third)) {
        b.push(draw());
        bt = total(b);
      }
    }
    let pay = 0;
    let text = "Banker wins";
    if (pt === bt) text = "Tie";
    else if (pt > bt) text = "Player wins";
    if (side === "player") pay = pt > bt ? stake * 2 : pt === bt ? stake : 0;
    if (side === "banker") pay = bt > pt ? Math.round(stake * 1.95) : bt === pt ? stake : 0;
    if (side === "tie") pay = pt === bt ? stake * 9 : 0;
    window.setTimeout(() => {
      setPlayer(p);
      setBanker(b);
      setNote(`${text} · ${pt} to ${bt}`);
      if (pay) credit(pay);
      record("Baccarat", stake, pay);
      setBusy(false);
    }, 420);
  };

  const cents = Math.round(amount * 100);
  const profit = side === "tie" ? cents * 8 : side === "banker" ? Math.round(cents * 0.95) : cents;

  return (
    <GameLayout
      title="Baccarat"
      note="Banker commission 5%"
      panel={
        <BetPanel amount={amount} onAmount={setAmount} profitCents={profit} label="Deal" onAction={deal} disabled={busy} error={error}>
          <div className="field">
            <span className="field-label">Bet on</span>
            <div className="select">
              {(["player", "banker", "tie"] as Side[]).map((item) => (
                <button key={item} type="button" className={side === item ? "on" : ""} disabled={busy} onClick={() => setSide(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        </BetPanel>
      }
    >
      <div className="bj">
        <Hand label={`Player · ${player.length ? total(player) : "—"}`} cards={player} />
        <p className="result-line">{note}</p>
        <Hand label={`Banker · ${banker.length ? total(banker) : "—"}`} cards={banker} />
      </div>
    </GameLayout>
  );
}

function Hand({ label, cards }: { label: string; cards: Card[] }) {
  return (
    <div className="hand">
      <span className="hand-label">{label}</span>
      <div className="cards">
        {cards.map((card, index) => (
          <div key={`${card.rank}${card.suit}${index}`} className={card.suit === "♥" || card.suit === "♦" ? "card red" : "card"}>
            <span>{card.rank}</span>
            <strong>{card.suit}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
