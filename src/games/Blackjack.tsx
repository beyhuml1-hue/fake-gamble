import { useRef, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { betCents } from "../lib/money";
import { shuffle } from "../lib/random";
import { useWallet } from "../state/wallet";

type Card = { rank: string; suit: string };
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

function shoe(): Card[] {
  const deck: Card[] = [];
  for (let i = 0; i < 4; i++) for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return shuffle(deck);
}

function value(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === "A") {
      aces += 1;
      total += 11;
    } else if (["J", "Q", "K"].includes(card.rank)) total += 10;
    else total += Number(card.rank);
  }
  while (total > 21 && aces) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function isRed(card: Card) {
  return card.suit === "♥" || card.suit === "♦";
}

export function Blackjack() {
  const { balance, debit, credit, record } = useWallet();
  const deck = useRef<Card[]>([]);
  const [amount, setAmount] = useState(1);
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [hideHole, setHideHole] = useState(false);
  const [stake, setStake] = useState(0);
  const [message, setMessage] = useState("Deal a hand");
  const [done, setDone] = useState(true);
  const [error, setError] = useState("");

  const draw = () => {
    if (deck.current.length < 15) deck.current = shoe();
    return deck.current.pop()!;
  };

  const finish = (cards: Card[], dealerCards: Card[], bet: number, note: string, pay: number) => {
    setPlayer(cards);
    setDealer(dealerCards);
    setHideHole(false);
    setDone(true);
    setMessage(note);
    if (pay) credit(pay);
    record("Blackjack", bet, pay);
  };

  const dealerPlay = (cards: Card[], dealerCards: Card[], bet: number) => {
    const next = [...dealerCards];
    while (value(next) < 17) next.push(draw());
    const pv = value(cards);
    const dv = value(next);
    if (dv > 21 || pv > dv) finish(cards, next, bet, "You win", bet * 2);
    else if (pv === dv) finish(cards, next, bet, "Push", bet);
    else finish(cards, next, bet, "Dealer wins", 0);
  };

  const deal = () => {
    const bet = betCents(amount, balance);
    if (bet == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(bet)) return;
    setError("");
    const p = [draw(), draw()];
    const d = [draw(), draw()];
    setStake(bet);
    setPlayer(p);
    setDealer(d);
    const pbj = value(p) === 21;
    const dbj = value(d) === 21;
    if (pbj || dbj) {
      const pay = pbj && dbj ? bet : pbj ? Math.round(bet * 2.5) : 0;
      finish(p, d, bet, pbj && dbj ? "Push" : pbj ? "Blackjack" : "Dealer blackjack", pay);
      return;
    }
    setHideHole(true);
    setDone(false);
    setMessage("Hit, stand, or double");
  };

  const hit = () => {
    const cards = [...player, draw()];
    setPlayer(cards);
    if (value(cards) > 21) finish(cards, dealer, stake, "Bust", 0);
  };

  const stand = () => dealerPlay(player, dealer, stake);

  const double = () => {
    if (balance < stake || player.length !== 2) return;
    if (!debit(stake)) return;
    const bet = stake * 2;
    setStake(bet);
    const cards = [...player, draw()];
    setPlayer(cards);
    if (value(cards) > 21) finish(cards, dealer, bet, "Bust", 0);
    else dealerPlay(cards, dealer, bet);
  };

  const cents = Math.round(amount * 100);

  return (
    <GameLayout
      title="Blackjack"
      note="3:2 blackjack"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={cents}
          label="Deal"
          onAction={deal}
          disabled={!done}
          locked={!done}
          error={error}
        >
          <p className="hint">Dealer stands on 17. Blackjack pays 3:2. Double on your first two cards.</p>
        </BetPanel>
      }
    >
      <div className="bj">
        <div className="hand">
          <span className="hand-label">Dealer · {hideHole ? value(dealer.slice(0, 1)) : value(dealer)}</span>
          <div className="cards">
            {dealer.map((card, index) =>
              hideHole && index === 1 ? (
                <div key="hole" className="card back" />
              ) : (
                <div key={`${card.rank}${card.suit}${index}`} className={isRed(card) ? "card red" : "card"}>
                  <span>{card.rank}</span>
                  <strong>{card.suit}</strong>
                </div>
              ),
            )}
          </div>
        </div>
        <p className="result-line">{message}</p>
        <div className="hand">
          <span className="hand-label">You · {player.length ? value(player) : "—"}</span>
          <div className="cards">
            {player.map((card, index) => (
              <div key={`${card.rank}${card.suit}${index}`} className={isRed(card) ? "card red" : "card"}>
                <span>{card.rank}</span>
                <strong>{card.suit}</strong>
              </div>
            ))}
          </div>
        </div>
        {!done ? (
          <div className="bj-actions">
            <button type="button" onClick={hit}>
              Hit
            </button>
            <button type="button" onClick={stand}>
              Stand
            </button>
            <button type="button" onClick={double} disabled={player.length !== 2 || balance < stake}>
              Double
            </button>
          </div>
        ) : null}
      </div>
    </GameLayout>
  );
}
