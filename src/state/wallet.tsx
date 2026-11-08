import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { MAX_BALANCE, START_CENTS } from "../lib/money";

const BALANCE_KEY = "fakegamble.playusd.cents";
const HISTORY_KEY = "fakegamble.history";

export type BetRecord = {
  id: string;
  game: string;
  wager: number;
  payout: number;
  at: number;
};

type WalletValue = {
  balance: number;
  history: BetRecord[];
  debit: (cents: number) => boolean;
  credit: (cents: number) => void;
  record: (game: string, wager: number, payout: number) => void;
  refill: () => void;
  setPracticeBalance: (cents: number) => void;
};

const WalletContext = createContext<WalletValue | null>(null);

function readBalance(): number {
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    if (raw == null) return START_CENTS;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return START_CENTS;
    return Math.min(MAX_BALANCE, Math.round(n));
  } catch {
    return START_CENTS;
  }
}

function readHistory(): BetRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BetRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row.wager === "number" && typeof row.payout === "number")
      .slice(0, 25);
  } catch {
    return [];
  }
}

function clamp(cents: number): number {
  return Math.max(0, Math.min(MAX_BALANCE, Math.round(cents)));
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState(readBalance);
  const [history, setHistory] = useState<BetRecord[]>(readHistory);
  const balanceRef = useRef(balance);

  useEffect(() => {
    try {
      localStorage.setItem(BALANCE_KEY, String(balance));
    } catch {
      /* private mode */
    }
  }, [balance]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      /* private mode */
    }
  }, [history]);

  const assign = (cents: number) => {
    const next = clamp(cents);
    balanceRef.current = next;
    setBalance(next);
  };

  const value: WalletValue = {
    balance,
    history,
    debit: (cents) => {
      if (!Number.isFinite(cents) || cents <= 0 || balanceRef.current < cents) return false;
      assign(balanceRef.current - cents);
      return true;
    },
    credit: (cents) => {
      if (!Number.isFinite(cents) || cents <= 0) return;
      assign(balanceRef.current + cents);
    },
    record: (game, wager, payout) => {
      const row: BetRecord = {
        id: crypto.randomUUID(),
        game,
        wager,
        payout,
        at: Date.now(),
      };
      setHistory((prev) => [row, ...prev].slice(0, 25));
    },
    refill: () => assign(START_CENTS),
    setPracticeBalance: (cents) => assign(cents),
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
