import {
  createContext, useContext, useEffect, useState,
  type FormEvent, type ReactNode,
} from "react";

type Phase = "loading" | "unavailable" | "email" | "code" | "authenticated" | "guest";
type AuthValue = {
  email: string | null;
  isGuest: boolean;
  canSignIn: boolean;
  logout: () => Promise<void>;
  showSignIn: () => void;
};
const AuthContext = createContext<AuthValue | null>(null);

type AuthResponse = {
  error?: string;
  message?: string;
  enabled?: boolean;
  user?: { email: string };
};

async function api(path: string, data?: object): Promise<AuthResponse> {
  const response = await fetch("/api/auth/" + path, {
    method: data ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: data ? { "Content-Type": "application/json" } : {},
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as AuthResponse;
  if (!response.ok) throw new Error(payload.error || "Authentication service unavailable.");
  return payload;
}

export function AuthProvider({ children }: { children: (key: string) => ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let alive = true;
    const initialize = async () => {
      try {
        const status = await api("status");
        if (!status.enabled) {
          if (alive) setPhase("unavailable");
          return;
        }
        if (alive) setEnabled(true);
        try {
          const result = await api("me");
          if (alive && result.user?.email) {
            setEmail(result.user.email);
            setPhase("authenticated");
            return;
          }
        } catch { /* An expired session should show the sign-in form. */ }
        if (alive) setPhase("email");
      } catch {
        if (alive) setPhase("unavailable");
      }
    };
    void initialize();
    return () => { alive = false; };
  }, []);

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api("request", { email: email.trim() });
      setNotice(result.message || "Check your email for a six-digit code.");
      setCode("");
      setPhase("code");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not send a code."); }
    finally { setBusy(false); }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await api("verify", { email: email.trim(), code });
      if (!result.user?.email) throw new Error("Could not finish signing in.");
      setEmail(result.user.email);
      setPhase("authenticated");
    } catch (err) { setError(err instanceof Error ? err.message : "That code did not work."); }
    finally { setBusy(false); }
  };

  const logout = async () => {
    if (phase === "authenticated") {
      try { await api("logout", {}); }
      catch {
        setError("Could not sign out on the server. Please retry.");
        return;
      }
    }
    setEmail(""); setCode(""); setError(""); setNotice(""); setPhase("email");
  };

  const showSignIn = () => {
    setError(""); setNotice("");
    setPhase("email");
  };

  const ready = phase === "authenticated" || phase === "guest";
  const context: AuthValue = {
    email: phase === "authenticated" ? email : null,
    isGuest: phase === "guest",
    canSignIn: enabled,
    logout,
    showSignIn,
  };
  if (ready) {
    // The existing wallet is browser-local; the verified email only selects
    // which local profile belongs to the account on this device.
    return <AuthContext.Provider value={context}>{children(phase === "guest" ? "phone" : email)}</AuthContext.Provider>;
  }
  if (phase === "loading") {
    return <div className="auth-screen"><div className="auth-card"><div className="auth-logo">B</div><h1>BlockBet</h1><p>Checking your session…</p></div></div>;
  }
  return (
    <div className="auth-screen">
      <section className="auth-card">
        <div className="auth-heading">
          <span className="auth-logo">B</span>
          <div><strong>BlockBet</strong><small>Player account</small></div>
        </div>
        {phase === "unavailable" ? (
          <>
            <h1>Email sign-in is being set up</h1>
            <p>The email service isn't ready on this server yet. You can still use your existing browser-only guest profile.</p>
            <button className="bet-btn auth-submit" type="button" onClick={() => setPhase("guest")}>Continue as guest</button>
            <p className="auth-fineprint">The site owner must connect a Cloudflare D1 database and an email provider.</p>
          </>
        ) : (
          <>
            <h1>{phase === "email" ? "Welcome to BlockBet" : "Check your email"}</h1>
            <p>{phase === "email" ? "Create an account or sign in using your email. No password needed." : <>We sent a six-digit code to <strong>{email}</strong>. The code expires in 10 minutes.</>}</p>
            {phase === "email" ? (
              <form onSubmit={requestCode} className="auth-form">
                <label htmlFor="account-email">Email address</label>
                <input id="account-email" type="email" name="email" placeholder="you@example.com"
                  autoComplete="email" inputMode="email" maxLength={254} required value={email}
                  onChange={(e) => setEmail(e.target.value)} disabled={busy} />
                <button className="bet-btn auth-submit" type="submit" disabled={busy}>{busy ? "Sending…" : "Send 6-digit code"}</button>
              </form>
            ) : (
              <form onSubmit={verifyCode} className="auth-form">
                <label htmlFor="account-code">Your verification code</label>
                <input id="account-code" type="text" name="code" placeholder="000000" required
                  autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="otp-input" disabled={busy} />
                <button className="bet-btn auth-submit" type="submit" disabled={busy || code.length !== 6}>
                  {busy ? "Checking…" : "Verify & sign in"}
                </button>
                <button className="auth-back" type="button" onClick={() => { setPhase("email"); setError(""); setNotice(""); }}>← Change email / resend code</button>
              </form>
            )}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <p className="auth-fineprint">18+ only. Do not share verification codes. Account verification does not make browser-local balances transferable between devices.</p>
          </>
        )}
      </section>
    </div>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth requires AuthProvider");
  return value;
}
