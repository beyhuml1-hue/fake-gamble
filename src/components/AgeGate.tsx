import { useEffect, useState, type ReactNode } from "react";

const KEY = "fakegamble.age";

export function AgeGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"ask" | "ok" | "no">("ask");

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "ok") setState("ok");
    } catch {
      /* ignore */
    }
  }, []);

  if (state === "ok") return children;

  const enter = () => {
    try {
      localStorage.setItem(KEY, "ok");
    } catch {
      /* ignore */
    }
    setState("ok");
  };

  return (
    <div className="age-screen">
      <div className="age-card">
        {state === "no" ? (
          <>
            <h1>Adults only</h1>
            <p>Blockbet is for people 18 and older.</p>
          </>
        ) : (
          <>
            <h1>Are you 18 or older?</h1>
            <p>Blockbet is an adults-only casino. You need to be 18 or older to enter.</p>
            <div className="age-actions">
              <button className="bet-btn" type="button" onClick={enter}>
                I’m 18 or older — enter
              </button>
              <button className="ghost-btn" type="button" onClick={() => setState("no")}>
                I’m under 18
              </button>
            </div>
            <p className="fineprint">18+ · Play responsibly</p>
          </>
        )}
      </div>
    </div>
  );
}
