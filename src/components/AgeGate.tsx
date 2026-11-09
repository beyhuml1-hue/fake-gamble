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
        <div className="auth-heading"><span className="auth-logo">B</span><strong>BlockBet</strong></div>
        {state === "no" ? (
          <>
            <h1>Adults only</h1>
            <p>You must be 18 or older to play.</p>
          </>
        ) : (
          <>
            <h1>Are you 18 or older?</h1>
            <p>BlockBet uses play money and is for adults only.</p>
            <div className="age-actions">
              <button className="bet-btn" type="button" onClick={enter}>
                Yes, enter BlockBet
              </button>
              <button className="ghost-btn" type="button" onClick={() => setState("no")}>
                No, I’m under 18
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
