const KEY = "blockbet.hot";

export function luckOn() {
  try {
    const mode=localStorage.getItem("blockbet.account-simulation");
    return mode==="hot" || (mode!=="cold" && localStorage.getItem(KEY)==="1");
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

export function coldOn(){
 try{return localStorage.getItem("blockbet.account-simulation")==="cold";}catch{return false;}
}
