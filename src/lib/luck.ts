const KEY = "blockbet.hot";
let practiceAllowed = false;
export function allowPracticeLuck(allowed: boolean) { practiceAllowed = allowed; }

export function luckOn() {
  if (!practiceAllowed) return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function toggleLuck() {
  const next = !luckOn();
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* private mode */
  }
  return next;
}

export function isLuckChord(event: KeyboardEvent) {
  if (event.altKey || event.key.toLowerCase() !== "l") return false;
  if (event.ctrlKey && event.shiftKey) return true;
  return (event.ctrlKey || event.metaKey) && !event.shiftKey;
}
