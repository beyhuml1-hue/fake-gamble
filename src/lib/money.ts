export const START_CENTS = 100_000;
export const MIN_BET = 10;
export const MAX_BALANCE = 100_000_000;

export const PEG_COPY =
  "Play USD is denominated 1:1 with the US dollar. It is play money: nothing on this site can be deposited or withdrawn.";

export function formatUSD(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return (
    sign +
    (abs / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    })
  );
}

export function formatAmount(cents: number): string {
  return (Math.abs(Math.round(cents)) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMult(mult: number): string {
  if (!Number.isFinite(mult) || mult <= 0) return "0.00×";
  if (mult >= 1000) return `${Math.round(mult).toLocaleString("en-US")}×`;
  if (mult >= 100) return `${mult.toFixed(1)}×`;
  return `${mult.toFixed(2)}×`;
}

export function betCents(dollars: number, balance: number): number | null {
  if (!Number.isFinite(dollars)) return null;
  const cents = Math.round(dollars * 100);
  if (cents < MIN_BET || cents > balance) return null;
  return cents;
}

export function payout(bet: number, mult: number): number {
  if (mult <= 0) return 0;
  return Math.max(0, Math.round(bet * mult));
}
