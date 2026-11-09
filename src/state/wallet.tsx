import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CARD_START_CENTS } from "../lib/card";
import { MAX_BALANCE, START_CENTS } from "../lib/money";
import type { BalanceAdjustment } from "../components/AuthProvider";
import { sound } from "../lib/sound";

const LEGACY_BALANCE = "fakegamble.playusd.v3";
const LEGACY_CARD = "fakegamble.card.v1";
const LEGACY_HISTORY = "fakegamble.history";
const MIGRATED = "blockbet.wallet.migrated";

export type BetRecord = {
  id: string;
  game: string;
  wager: number;
  payout: number;
  at: number;
};

export type LedgerRow = {
  id: string;
  kind: "deposit" | "withdrawal";
  cents: number;
  at: number;
  ref: string;
};

type Saved = {
  balanceRevision?: string;
  balance: number;
  card: number;
  history: BetRecord[];
  ledger: LedgerRow[];
};

type WalletValue = {
  balance: number;
  cardBalance: number;
  history: BetRecord[];
  ledger: LedgerRow[];
  cashierNonce: number;
  debit: (cents: number) => boolean;
  credit: (cents: number) => void;
  record: (game: string, wager: number, payout: number) => void;
  openCashier: () => void;
  depositFromCard: (cents: number) => string | null;
  withdrawToCard: (cents: number) => string | null;
};

const WalletContext = createContext<WalletValue | null>(null);

function walletKey(email: string) {
  return `blockbet.wallet.v1:${email}`;
}

function clamp(cents: number): number {
  return Math.max(0, Math.min(MAX_BALANCE, Math.round(cents)));
}

function readNumber(key: string, fallback: number) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.round(n);
  } catch {
    return fallback;
  }
}

function readHistory(raw: string | null): BetRecord[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BetRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.wager === "number" && typeof row.payout === "number").slice(0, 250);
  } catch {
    return [];
  }
}

function load(email: string): Saved {
  const fresh = (): Saved => ({ balance: START_CENTS, card: CARD_START_CENTS, history: [], ledger: [] });
  const parse = (raw: string): Saved | null => {
    try {
      const parsed = JSON.parse(raw) as Saved;
      return {
        balanceRevision: typeof parsed.balanceRevision === "string" ? parsed.balanceRevision : undefined,
        balance: clamp(Number(parsed.balance) || 0),
        card: Math.max(0, Math.round(Number(parsed.card) || 0)),
        history: readHistory(JSON.stringify(parsed.history ?? [])),
        ledger: Array.isArray(parsed.ledger) ? parsed.ledger.slice(0, 40) : [],
      };
    } catch {
      return null;
    }
  };

  try {
    const migrated = localStorage.getItem(MIGRATED);
    const existing = localStorage.getItem(walletKey(email));
    if (existing && migrated && migrated !== "undefined") return parse(existing) ?? fresh();
    if (!migrated || migrated === "undefined") {
      const saved: Saved = {
        balance: clamp(readNumber(LEGACY_BALANCE, START_CENTS)),
        card: readNumber(LEGACY_CARD, CARD_START_CENTS),
        history: readHistory(localStorage.getItem(LEGACY_HISTORY)),
        ledger: [],
      };
      localStorage.setItem(MIGRATED, email);
      localStorage.setItem(walletKey(email), JSON.stringify(saved));
      return saved;
    }
    if (existing) return parse(existing) ?? fresh();
  } catch {
    return fresh();
  }
  return fresh();
}

function reference() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return `BB-${buf[0]!.toString(16).toUpperCase().padStart(8, "0")}`;
}

function applyAdjustment(saved: Saved, adjustment?: BalanceAdjustment | null): Saved {
  if (!adjustment || adjustment.revision === saved.balanceRevision) return saved;
  return { ...saved, balance: clamp(adjustment.mode === "add" ? saved.balance + adjustment.cents : adjustment.cents), balanceRevision: adjustment.revision };
}

export function WalletProvider({ email, children, adjustment }: {
  email: string;
  children: ReactNode;
  adjustment?: BalanceAdjustment | null;
}) {
  const [stored, setSaved] = useState<Saved>(() => applyAdjustment(load(email), adjustment));
  const saved = applyAdjustment(stored, adjustment);
  if (saved !== stored) setSaved(saved);
  const [cashierNonce, setCashierNonce] = useState(0);
  const balanceRef = useRef(saved.balance);
  const cardRef = useRef(saved.card);
  balanceRef.current = saved.balance;
  cardRef.current = saved.card;

  useEffect(() => {
    try {
      localStorage.setItem(walletKey(email), JSON.stringify(saved));
    } catch {
      /* private mode */
    }
  }, [email, saved]);

  const assign = (balance: number, card = cardRef.current) => {
    const nextBalance = clamp(balance);
    const nextCard = Math.max(0, Math.round(card));
    balanceRef.current = nextBalance;
    cardRef.current = nextCard;
    setSaved((prev) => ({ ...prev, balance: nextBalance, card: nextCard }));
  };

  const value: WalletValue = {
    balance: saved.balance,
    cardBalance: saved.card,
    history: saved.history,
    ledger: saved.ledger,
    cashierNonce,
    debit: (cents) => {
      if (!Number.isFinite(cents) || cents <= 0 || balanceRef.current < cents) return false;
      assign(balanceRef.current - cents);
      sound.bet();
      return true;
    },
    credit: (cents) => {
      if (!Number.isFinite(cents) || cents <= 0) return;
      assign(balanceRef.current + cents);
      sound.win();
    },
    record: (game, wager, payout) => {
      if (payout <= 0) sound.lose();
      const row: BetRecord = { id: crypto.randomUUID(), game, wager, payout, at: Date.now() };
      setSaved((prev) => ({ ...prev, history: [row, ...prev.history].slice(0, 250) }));
      window.dispatchEvent(new CustomEvent("blockbet:settled", { detail: row }));
      // Share settled bets from signed-in players only.
      // Publishing is best-effort and never changes the wallet outcome.
      if (email !== "phone") {
        void fetch("/api/auth/live-bets", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row)
        }).then(() => window.dispatchEvent(new Event("blockbet:bet"))).catch(() => {});
      }
    },
    openCashier: () => setCashierNonce((n) => n + 1),
    depositFromCard: (cents) => {
      if (cents < 100) return "Minimum deposit is $1.00.";
      if (cardRef.current < cents) return "Declined. Insufficient funds.";
      const row: LedgerRow = { id: crypto.randomUUID(), kind: "deposit", cents, at: Date.now(), ref: reference() };
      const nextBalance = clamp(balanceRef.current + cents);
      const nextCard = cardRef.current - cents;
      balanceRef.current = nextBalance;
      cardRef.current = nextCard;
      setSaved((prev) => ({
        ...prev,
        balance: nextBalance,
        card: nextCard,
        ledger: [row, ...prev.ledger].slice(0, 40),
      }));
      sound.cash();
      return null;
    },
    withdrawToCard: (cents) => {
      if (cents < 100) return "Minimum withdrawal is $1.00.";
      if (balanceRef.current < cents) return "Insufficient balance.";
      const row: LedgerRow = { id: crypto.randomUUID(), kind: "withdrawal", cents, at: Date.now(), ref: reference() };
      const nextBalance = clamp(balanceRef.current - cents);
      const nextCard = cardRef.current + cents;
      balanceRef.current = nextBalance;
      cardRef.current = nextCard;
      setSaved((prev) => ({
        ...prev,
        balance: nextBalance,
        card: nextCard,
        ledger: [row, ...prev.ledger].slice(0, 40),
      }));
      sound.cash();
      return null;
    },
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
