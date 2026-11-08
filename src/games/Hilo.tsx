import { useMemo, useState } from "react";
import { BetPanel } from "../components/BetPanel";
import { GameLayout } from "../components/GameLayout";
import { EDGE } from "../lib/math";
import { betCents, formatMult, formatUSD, payout } from "../lib/money";
import { shuffle } from "../lib/random";
import { useWallet } from "../state/wallet";

type Card = { rank: string; suit: string };
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

function freshShoe(): Card[] {
  const deck: Card[] = [];
  for (let i = 0; i < 4; i++) for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return shuffle(deck);
}

function rankOf(card: Card) {
  return RANKS.indexOf(card.rank);
}

export function Hilo() {
  const { balance, debit, credit, record } = useWallet();
  const [amount, setAmount] = useState(1);
  const [shoe, setShoe] = useState<Card[]>(() => freshShoe());
  const [card, setCard] = useState<Card | null>(null);
  const [mult, setMult] = useState(1);
  const [stake, setStake] = useState(0);
  const [active, setActive] = useState(false);
  const [note, setNote] = useState("Start a ladder");
  const [win, setWin] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  const odds = useMemo(() => {
    if (!card) return { higher: 0, lower: 0, same: 0 };
    const total = shoe.length || 1;
    const r = rankOf(card);
    const higher = shoe.filter((item) => rankOf(item) > r).length;
    const lower = shoe.filter((item) => rankOf(item) < r).length;
    const same = shoe.filter((item) => rankOf(item) === r).length;
    const price = (count: number) => (count ? ((1 - EDGE) * total) / count : 0);
    return { higher: price(higher), lower: price(lower), same: price(same) };
  }, [card, shoe]);

  const pull = (source: Card[]) => {
    const next = source.length < 10 ? freshShoe() : [...source];
    const drawn = next.pop()!;
    setShoe(next);
    setCard(drawn);
    return drawn;
  };

  const start = () => {
    const bet = betCents(amount, balance);
    if (bet == null) {
      setError("Minimum bet is $0.10, and it can't be more than your balance.");
      return;
    }
    if (!debit(bet)) return;
    setError("");
    setStake(bet);
    setMult(1);
    setActive(true);
    setWin(null);
    setNote("Higher, lower, or skip");
    pull(shoe);
  };

  const guess = (dir: "higher" | "lower" | "same") => {
    if (!active || !card) return;
    const step = odds[dir];
    if (!step) return;
    const drawn = pull(shoe);
    const diff = rankOf(drawn) - rankOf(card);
    const ok = dir === "higher" ? diff > 0 : dir === "lower" ? diff < 0 : diff === 0;
    if (!ok) {
      setActive(false);
      setWin(false);
      setNote("Wrong card");
      record("Hi-Lo", stake, 0);
      return;
    }
    setMult(mult * step);
    setWin(true);
    setNote("Cash out or keep going");
  };

  const cashout = () => {
    if (!active || mult <= 1) return;
    const pay = payout(stake, mult);
    if (pay) credit(pay);
    record("Hi-Lo", stake, pay);
    setActive(false);
    setNote(`Cashed ${formatUSD(pay)}`);
  };

  const cents = Math.round(amount * 100);
  const profit = active ? Math.max(0, payout(stake, mult) - stake) : Math.max(0, payout(Math.max(cents, 0), odds.higher || 1.5) - Math.max(cents, 0));

  return (
    <GameLayout
      title="Hi-Lo"
      note="99% RTP"
      panel={
        <BetPanel
          amount={amount}
          onAmount={setAmount}
          profitCents={profit}
          label={active ? `Cash out ${formatUSD(payout(stake, Math.max(mult, 1)))}` : "Bet"}
          onAction={active ? cashout : start}
          disabled={active && mult <= 1}
          cashout={active && mult > 1}
          locked={active}
          error={error}
        />
      }
    >
      <div className="hilo">
        {card ? (
          <div className={card.suit === "♥" || card.suit === "♦" ? "hilo-card red" : "hilo-card"}>
            <span>{card.rank}</span>
            <strong>{card.suit}</strong>
          </div>
        ) : (
          <div className="hilo-card back" />
        )}
        <p className={win == null ? "result-line" : win ? "result-line win" : "result-line lose"}>
          {note} · {formatMult(mult)}
        </p>
        <div className="hilo-actions">
          <button type="button" disabled={!active || !odds.higher} onClick={() => guess("higher")}>
            Higher
            <small>{odds.higher ? formatMult(odds.higher) : "—"}</small>
          </button>
          <button type="button" disabled={!active || !odds.lower} onClick={() => guess("lower")}>
            Lower
            <small>{odds.lower ? formatMult(odds.lower) : "—"}</small>
          </button>
          <button type="button" disabled={!active || !odds.same} onClick={() => guess("same")}>
            Same
            <small>{odds.same ? formatMult(odds.same) : "—"}</small>
          </button>
          <button type="button" disabled={!active} onClick={() => pull(shoe)}>
            Skip
          </button>
        </div>
      </div>
    </GameLayout>
  );
}
