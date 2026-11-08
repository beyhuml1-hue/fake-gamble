import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { formatUSD, MIN_BET } from "../lib/money";
import { useWallet } from "../state/wallet";

type Props = {
  amount: number;
  onAmount: (value: number) => void;
  profitCents: number;
  label: string;
  onAction: () => void;
  disabled?: boolean;
  cashout?: boolean;
  locked?: boolean;
  error?: string;
  children?: ReactNode;
};

export function BetPanel({
  amount,
  onAmount,
  profitCents,
  label,
  onAction,
  disabled,
  cashout,
  locked,
  error,
  children,
}: Props) {
  const { balance, openCashier } = useWallet();
  const [text, setText] = useState(amount.toFixed(2));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(amount.toFixed(2));
  }, [amount, focused]);

  const broke = balance < MIN_BET && !cashout;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled || broke) return;
    onAction();
  };

  const write = (next: number) => {
    const safe = Math.max(0, Math.round(next * 100) / 100);
    onAmount(safe);
    setText(safe.toFixed(2));
  };

  return (
    <form className="panel-form" onSubmit={submit}>
      <div className="tabs" role="tablist">
        <button className="tab active" type="button" role="tab" aria-selected="true">
          Manual
        </button>
      </div>

      <label className="field">
        <span className="field-label">Bet Amount</span>
        <span className="amount">
          <span className="amount-prefix">$</span>
          <input
            inputMode="decimal"
            value={text}
            disabled={locked}
            aria-label="Bet amount in US dollars"
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              const parsed = Number(text);
              if (Number.isFinite(parsed)) write(parsed);
              else setText(amount.toFixed(2));
            }}
            onChange={(event) => {
              const raw = event.target.value;
              if (!/^\d*\.?\d{0,2}$/.test(raw)) return;
              setText(raw);
              const parsed = Number(raw);
              if (Number.isFinite(parsed)) onAmount(parsed);
            }}
          />
          <button className="step-btn" type="button" disabled={locked} onClick={() => write(amount / 2)}>
            ½
          </button>
          <button className="step-btn" type="button" disabled={locked} onClick={() => write(Math.min(balance / 100, amount * 2))}>
            2×
          </button>
        </span>
      </label>

      {children}

      <div className="field">
        <span className="field-label">Profit on Win</span>
        <div className="profit-box">
          <span>$</span>
          <strong>{formatUSD(profitCents).replace("$", "")}</strong>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {broke ? (
        <button className="bet-btn" type="button" onClick={openCashier}>
          Deposit
        </button>
      ) : (
        <button className={cashout ? "bet-btn cashout" : "bet-btn"} type="submit" disabled={disabled}>
          {label}
        </button>
      )}
    </form>
  );
}
