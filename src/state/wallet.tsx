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

export type WalletNotification={id:string;sender:string;cents:number;at:number};
type PendingOp = {id:string;delta:number};
type Saved = {
  pendingOps?: PendingOp[];
  socialCursor?: number;
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
  walletReady:boolean;
  prepareTransfer: () => Promise<number|null>;
  notifications: WalletNotification[];
  dismissNotification: (id:string) => void;
  syncSocialWallet: () => void;
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
  const fresh = (): Saved => ({ balance: START_CENTS, card: CARD_START_CENTS, history: [], ledger: [], pendingOps: [] });
  const parse = (raw: string): Saved | null => {
    try {
      const parsed = JSON.parse(raw) as Saved;
      return {
        balanceRevision: typeof parsed.balanceRevision === "string" ? parsed.balanceRevision : undefined,
        pendingOps: Array.isArray(parsed.pendingOps) ? parsed.pendingOps.filter(op=>
          typeof op?.id==="string"&&/^[0-9a-f-]{36}$/i.test(op.id)&&Number.isSafeInteger(op.delta)&&Math.abs(op.delta)<=MAX_BALANCE&&op.delta!==0
        ).slice(0,250) : [],
        socialCursor: Number.isSafeInteger(parsed.socialCursor) && (parsed.socialCursor||0)>=0 ? parsed.socialCursor : 0,
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
        pendingOps: [],
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
  const [notifications,setNotifications] = useState<WalletNotification[]>([]);
  const opsRef=useRef<PendingOp[]>(saved.pendingOps||[]);
  const seedBalance=useRef(clamp(saved.balance-(saved.pendingOps||[]).reduce((total,op)=>total+op.delta,0)));
  const flushRef=useRef(false);
  const bootRef=useRef(false);
  const walletReadyRef=useRef(email==="phone");
  const [walletReady,setWalletReady]=useState(email==="phone");
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

  // Signed-in accounts have ONE canonical server Play USD balance.
  // The existing browser balance is imported once, preserving old games/history.
  // Individual game debits and credits are recorded with durable UUID receipts.
  async function flushGameOps():Promise<boolean>{
    if(email==="phone")return true;
    if(!walletReadyRef.current)return false;
    if(flushRef.current)return false;
    flushRef.current=true;
    let success=true;
    try{
      while(opsRef.current.length){
        const op=opsRef.current[0]!;
        const response=await fetch("/api/auth/playusd",{
          method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"game",id:op.id,delta:op.delta})
        });
        if(!response.ok){
          if(response.status===409){
            // Concurrent transfer on another device can invalidate an
            // optimistic local game action. Use the canonical server balance.
            opsRef.current=[];
            setSaved(prev=>({...prev,pendingOps:[]}));
          }
          success=false;
          break;
        }
        opsRef.current=opsRef.current.filter(item=>item.id!==op.id);
        setSaved(prev=>({...prev,pendingOps:(prev.pendingOps||[]).filter(item=>item.id!==op.id)}));
      }
    }catch{success=false;}
    finally{flushRef.current=false;}
    return success&&opsRef.current.length===0;
  }
  async function refreshMainWallet():Promise<number|null>{
    if(email==="phone")return balanceRef.current;
    try{
      let response=await fetch("/api/auth/playusd",{cache:"no-store",credentials:"same-origin"});
      if(!response.ok)return null;
      let data=await response.json() as {ready?:boolean;balance?:number};
      if(!data.ready){
        response=await fetch("/api/auth/playusd",{
          method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"initialize",balance:seedBalance.current})
        });
        if(!response.ok)return null;
        data=await response.json();
      }
      if(typeof data.balance!=="number"||!Number.isSafeInteger(data.balance)||data.balance<0||data.balance>MAX_BALANCE)return null;
      walletReadyRef.current=true;
      setWalletReady(true);
      if(opsRef.current.length){
        const completed=await flushGameOps();
        if(!completed)return null;
        response=await fetch("/api/auth/playusd",{cache:"no-store",credentials:"same-origin"});
        if(!response.ok)return null;
        data=await response.json();
      }
      if(Number.isSafeInteger(data.balance)&&data.balance!>=0&&data.balance!<=MAX_BALANCE&&!opsRef.current.length){
        balanceRef.current=data.balance!;
        setSaved(prev=>prev.balance===data.balance?prev:{...prev,balance:data.balance!});
        return data.balance!;
      }
    }catch{/* Network failure is retried; pending operations remain on disk. */}
    return null;
  }

  useEffect(() => {
    if(email==="phone")return;
    let disposed=false;
    const sync=async()=>{
      if(disposed||bootRef.current||document.hidden)return;
      bootRef.current=true;
      try{
        await refreshMainWallet();
        const response=await fetch("/api/auth/wallet-events?notices=1",{cache:"no-store",credentials:"same-origin"});
        if(!response.ok||disposed)return;
        const payload=await response.json() as {notifications?:WalletNotification[]};
        if(Array.isArray(payload.notifications))setNotifications(payload.notifications.filter(n=>
          typeof n.id==="string"&&typeof n.sender==="string"&&Number.isSafeInteger(n.cents)&&n.cents>0
        ).slice(0,5));
      }catch{/* Retry on next poll. */}
      finally{bootRef.current=false;}
    };
    const onSync=()=>{void sync();};
    void sync();
    const timer=window.setInterval(onSync,4000);
    window.addEventListener("focus",onSync);
    window.addEventListener("blockbet:wallet-sync",onSync);
    return()=>{
      disposed=true;
      clearInterval(timer);
      window.removeEventListener("focus",onSync);
      window.removeEventListener("blockbet:wallet-sync",onSync);
    };
  },[email]);

  function queueDelta(delta:number){
    if(email==="phone")return;
    const op={id:crypto.randomUUID(),delta};
    opsRef.current=[...opsRef.current,op];
    setSaved(prev=>({...prev,pendingOps:[...(prev.pendingOps||[]),op]}));
    window.dispatchEvent(new Event("blockbet:wallet-sync"));
  }
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
    walletReady,
    prepareTransfer: async()=>{
      if(!walletReadyRef.current||email==="phone")return null;
      const synced=await refreshMainWallet();
      return opsRef.current.length?null:synced;
    },
    notifications,
    dismissNotification: (id) => {
      setNotifications(prev=>prev.filter(x=>x.id!==id));
      void fetch("/api/auth/wallet-events",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"dismiss",id})
      }).catch(()=>{});
    },
    syncSocialWallet: () => window.dispatchEvent(new Event("blockbet:wallet-sync")),
    debit: (cents) => {
      if (!Number.isSafeInteger(cents) || cents <= 0 || balanceRef.current < cents) return false;
      assign(balanceRef.current - cents);
      queueDelta(-cents);
      sound.bet();
      return true;
    },
    credit: (cents) => {
      if (!Number.isSafeInteger(cents) || cents <= 0) return;
      assign(balanceRef.current + cents);
      queueDelta(cents);
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
