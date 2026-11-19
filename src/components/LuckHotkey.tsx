import { useEffect, useState } from "react";
import { allowPracticeLuck, isLuckChord, luckOn, toggleLuck } from "../lib/luck";
import { useAuth } from "./AuthProvider";

export function LuckHotkey() {
  const {isGuest}=useAuth();
  const [toast, setToast] = useState("");
  const [boosted,setBoosted]=useState(false);
  useEffect(()=>{allowPracticeLuck(isGuest);setBoosted(luckOn());return()=>allowPracticeLuck(false);},[isGuest]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if(!isGuest)return;
      if (!isLuckChord(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const on = toggleLuck();
      setBoosted(on);
      setToast(on ? "Practice boost on · guest wallet only" : "Practice boost off");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isGuest]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast&&!boosted) return null;
  return <div className="toast" role="status">{toast||"Practice boost active · guest wallet only"}</div>;
}
