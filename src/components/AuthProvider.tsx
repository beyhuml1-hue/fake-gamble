import {
  createContext, useContext, useEffect, useState,
  type FormEvent, type ReactNode,
} from "react";

type Phase = "loading" | "login" | "signup" | "verify" | "authenticated" | "guest";
export type BalanceAdjustment = { cents: number; revision: string; mode?: "set" | "add" };
type Account = { email: string; displayName?: string; admin?: boolean; balanceAdjustment?: BalanceAdjustment | null };
type AuthValue = {
  isAdmin: boolean;
  email: string | null;
  displayName: string | null;
  isGuest: boolean;
  canSignIn: boolean;
  logout: () => Promise<void>;
  showSignIn: () => void;
  showSignUp: () => void;
};
const AuthContext = createContext<AuthValue | null>(null);

type AuthResponse = {
  error?: string;
  message?: string;
  enabled?: boolean;
  user?: Account;
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
  if (!response.ok) throw new Error(payload.error || "Account service unavailable. Please try again.");
  return payload;
}

export function AuthProvider({ children }: { children: (key: string, adjustment?: BalanceAdjustment | null) => ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [enabled, setEnabled] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        const status = await api("status");
        if (!status.enabled) {
          if (alive) setPhase("guest");
          return;
        }
        if (alive) setEnabled(true);
        try {
          const result = await api("me");
          if (alive && result.user?.email) {
            setAccount(result.user);
            setEmail(result.user.email);
            setPhase("authenticated");
            return;
          }
        } catch { /* No active session. */ }
        if (alive) setPhase("guest");
      } catch {
        if (alive) setPhase("guest");
      }
    }
    void init();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (phase !== "authenticated") return;
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store", signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setAccount(null);
          setPhase("login");
          setError("Your session ended. Log in again to continue.");
        } else if (response.ok) {
          const result: AuthResponse = await response.json();
          if (result.user && !controller.signal.aborted) setAccount(result.user);
        }
      } catch {
        // Keep the current session during a temporary network failure.
      } finally {
        pending = false;
      }
    }
    const interval = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [phase]);

  function switchTo(next: "login" | "signup") {
    setPhase(next);
    setError(""); setNotice(""); setPassword(""); setCode(""); setVisible(false);
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await api("login", { email: email.trim(), password });
      if (!result.user?.email) throw new Error("Couldn't log in.");
      setAccount(result.user);
      setEmail(result.user.email);
      setPassword(""); setPhase("authenticated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't log in.");
    } finally { setBusy(false); }
  }

  async function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (password.length < 6 || password.length > 128) {
      setError("Choose a password with at least 6 characters."); return;
    }
    setBusy(true);
    try {
      const result = await api("signup", { email: email.trim(), password });
      setNotice(result.message || "We've sent your six-digit verification code.");
      setCode(""); setPassword(""); setPhase("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start sign-up.");
    } finally { setBusy(false); }
  }

  async function submitVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api("verify", { email: email.trim(), code });
      if (!result.user?.email) throw new Error("Could not verify your account.");
      setAccount(result.user);
      setEmail(result.user.email);
      setCode(""); setPhase("authenticated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect or expired code.");
    } finally { setBusy(false); }
  }

  async function resendCode() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api("request", { email: email.trim() });
      setNotice(result.message || "Another code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't resend the code.");
    } finally { setBusy(false); }
  }

  const logout = async () => {
    if (phase === "authenticated") {
      try { await api("logout", {}); }
      catch {
        setError("Couldn't sign out on the server. Please retry.");
        return;
      }
    }
    setAccount(null);
    setEmail(""); switchTo("login");
  };

  const showSignIn = () => switchTo("login");
  const showSignUp = () => switchTo("signup");
  const signedIn = phase === "authenticated";
  const editing = phase === "login" || phase === "signup" || phase === "verify";
  const context: AuthValue = {
    isAdmin: phase === "authenticated" && account?.admin === true,
    email: signedIn ? account?.email ?? null : null,
    displayName: signedIn ? account?.displayName ?? "Player" : null,
    isGuest: !signedIn,
    canSignIn: enabled,
    logout,
    showSignIn,
    showSignUp,
  };
  if (phase === "loading") {
    return <div className="auth-screen"><div className="auth-card">
      <div className="auth-logo">D</div><h1>DonutFlip</h1><p>Checking your session…</p>
    </div></div>;
  }

  return (
    <AuthContext.Provider value={context}>
    <div className="auth-app" inert={editing}>{children(signedIn ? account?.email ?? email : "phone", signedIn ? account?.balanceAdjustment : null)}</div>
    {editing && <div className="auth-screen auth-overlay" onKeyDown={event=>{if(event.key==="Escape"&&!busy)setPhase("guest");}}>
      <section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
        <div className="auth-heading">
          <span className="auth-logo">D</span>
          <div><strong>DonutFlip</strong><small>Play-money profile</small></div>
          <button type="button" className="auth-close" disabled={busy} aria-label="Close sign-in" onClick={()=>setPhase("guest")}>&times;</button>
        </div>
        {phase === "verify" ? (
          <>
            <div className="auth-verify-icon" aria-hidden="true">✉</div>
            <h1 id="auth-dialog-title">Verify your email</h1>
            <p>Enter the six-digit code sent to <strong>{email}</strong>. Your code expires in 10 minutes.</p>
            <form className="auth-form" onSubmit={submitVerify}>
              <label htmlFor="account-code">Verification code</label>
              <input id="account-code" className="otp-input" type="text" name="code"
                autoComplete="one-time-code" autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                placeholder="000000" required disabled={busy} value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}/>
              <button type="submit" className="bet-btn auth-submit" disabled={busy || code.length !== 6}>
                {busy ? "Verifying…" : "Verify & create account"}
              </button>
            </form>
            <button className="auth-back" type="button" disabled={busy} onClick={() => void resendCode()}>Resend code</button>
            <button className="auth-back" type="button" disabled={busy} onClick={() => switchTo("signup")}>← Back to sign up</button>
          </>
        ) : (
          <>
            <h1 id="auth-dialog-title">{phase === "signup" ? "Create an account" : "Sign in"}</h1>
            <p>{phase === "signup" ? "We'll email you a six-digit code to confirm your address." : "Enter your email and password to access your account."}</p>
            <div className="auth-switch" role="group" aria-label="Account access">
              <button type="button" className={phase === "login" ? "selected" : ""} onClick={() => switchTo("login")} aria-pressed={phase === "login"}>Log in</button>
              <button type="button" className={phase === "signup" ? "selected" : ""} onClick={() => switchTo("signup")} aria-pressed={phase === "signup"}>Sign up</button>
            </div>
            <form className="auth-form" onSubmit={phase === "signup" ? submitSignup : submitLogin}>
              <label htmlFor="account-email">Email address</label>
              <input id="account-email" type="email" name="email" placeholder="you@example.com"
                autoComplete="username" autoFocus inputMode="email" maxLength={254}
                required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
              <label htmlFor="account-password">Password</label>
              <div className="auth-password-wrap">
                <input id="account-password" name="password" type={visible ? "text" : "password"}
                  placeholder={phase === "signup" ? "At least 6 characters" : "Enter your password"}
                  autoComplete={phase === "signup" ? "new-password" : "current-password"}
                  minLength={phase === "signup" ? 6 : 1} maxLength={128}
                  required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
                <button type="button" aria-label={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible(v => !v)}>{visible ? "Hide" : "Show"}</button>
              </div>
              <button className="bet-btn auth-submit" type="submit" disabled={busy}>
                {busy ? "Please wait…" : phase === "signup" ? "Create account" : "Log in"}
              </button>
            </form>
          </>
        )}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-guest-link" type="button" onClick={() => setPhase("guest")}>
          Continue as guest <span aria-hidden="true">→</span>
        </button>
        <p className="auth-fineprint">18+ · Play coins are simulated and have no cash value.</p>
      </section>
    </div>}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth requires AuthProvider");
  return value;
}
