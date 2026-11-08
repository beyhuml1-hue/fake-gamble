import { useEffect, useState } from "react";
import { isLuckChord, toggleLuck } from "../lib/luck";

export function LuckHotkey() {
  const [toast, setToast] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isLuckChord(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const on = toggleLuck();
      setToast(on ? "Hot table on" : "Hot table off");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return <div className="toast">{toast}</div>;
}
