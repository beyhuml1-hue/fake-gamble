const DAILY = "donutflip.daily";
const REFERRAL = "donutflip.referral";

export const DAILY_COINS_CENTS = 5_000;
export const REFERRAL_COINS_CENTS = 15_000;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function dailyReady(): boolean {
  try {
    return localStorage.getItem(DAILY) !== today();
  } catch {
    return true;
  }
}

export function markDaily() {
  try { localStorage.setItem(DAILY, today()); } catch { /* private mode */ }
}

export function referralReady(): boolean {
  try { return localStorage.getItem(REFERRAL) !== "1"; } catch { return true; }
}

export function markReferral() {
  try { localStorage.setItem(REFERRAL, "1"); } catch { /* private mode */ }
}
