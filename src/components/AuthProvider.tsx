import {
  createContext, useContext, useEffect, useState,
  type FormEvent, type ReactNode,
} from "react";

type Phase = "loading" | "unavailable" | "login" | "signup" | "verify" | "authenticated" | "guest";
export type BalanceAdjustment = { cents: number; revision: string; mode?: "set" | "add" };
type Account = { email: string; admin?: boolean; balanceAdjustment?: BalanceAdjustment | null };
type AuthValue = {
  isAdmin: boolean;
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
  const [confirm, setConfirm] = useState("");
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
          if (alive) setPhase("unavailable");
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
        if (alive) setPhase("login");
      } catch {
        if (alive) setPhase("unavailable");
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
    setError(""); setNotice(""); setPassword(""); setConfirm(""); setCode(""); setVisible(false);
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await api("login", { email: email.trim(), password });
      if (!result.user?.email) throw new Error("Couldn't log in.");
      setAccount(result.user);
      setEmail(result.user.email);
      setPassword(""); setConfirm(""); setPhase("authenticated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't log in.");
    } finally { setBusy(false); }
  }

  async function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (password.length < 6 || password.length > 128) {
      setError("Choose a password with at least 6 characters."); return;
    }
    if (password !== confirm) { setError("Your passwords don't match."); return; }
    setBusy(true);
    try {
      const result = await api("signup", { email: email.trim(), password });
      setNotice(result.message || "We've sent your six-digit verification code.");
      setCode(""); setPassword(""); setConfirm(""); setPhase("verify");
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
  const ready = phase === "authenticated" || phase === "guest";
  const context: AuthValue = {
    isAdmin: phase === "authenticated" && account?.admin === true,
    email: phase === "authenticated" ? email : null,
    isGuest: phase === "guest",
    canSignIn: enabled,
    logout,
    showSignIn,
  };
  if (ready) {
    // Wallet state remains browser-local, namespaced to verified accounts on this device.
    return <AuthContext.Provider value={context}>
      {children(phase === "guest" ? "phone" : email, phase === "authenticated" ? account?.balanceAdjustment : null)}
    </AuthContext.Provider>;
  }

  if (phase === "loading") {
    return <div className="auth-screen"><div className="auth-card">
      <div className="auth-logo">B</div><h1>BlockBet</h1><p>Checking your session…</p>
    </div></div>;
  }

  return (
    <div className="auth-screen">
      <section className="auth-card" aria-label="BlockBet player account">
        <div className="auth-heading">
          <span className="auth-logo">B</span>
          <div><strong>BlockBet</strong><small>Player account</small></div>
        </div>
        {phase === "unavailable" ? (
          <>
            <h1>Accounts are temporarily unavailable</h1>
            <p>You can still play as a guest. Your balance stays on this device.</p>
            <button type="button" className="auth-back" onClick={() => window.location.reload()}>Try again</button>
          </>
        ) : phase === "verify" ? (
          <>
            <div className="auth-verify-icon" aria-hidden="true">✉</div>
            <h1>Verify your email</h1>
            <p>Enter the six-digit code sent to <strong>{email}</strong>. Your code expires in 10 minutes.</p>
            <form className="auth-form" onSubmit={submitVerify}>
              <label htmlFor="account-code">Verification code</label>
              <input id="account-code" className="otp-input" type="text" name="code"
                autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
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
            <h1>{phase === "signup" ? "Create an account" : "Log in"}</h1>
            <p>{phase === "signup" ? "We'll email you a six-digit code to confirm your address." : "Enter your email and password to access your account."}</p>
            <div className="auth-switch" role="group" aria-label="Account access">
              <button type="button" className={phase === "login" ? "selected" : ""} onClick={() => switchTo("login")} aria-pressed={phase === "login"}>Log in</button>
              <button type="button" className={phase === "signup" ? "selected" : ""} onClick={() => switchTo("signup")} aria-pressed={phase === "signup"}>Sign up</button>
            </div>
            <form className="auth-form" onSubmit={phase === "signup" ? submitSignup : submitLogin}>
              <label htmlFor="account-email">Email address</label>
              <input id="account-email" type="email" name="email" placeholder="you@example.com"
                autoComplete="email" inputMode="email" maxLength={254}
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
              {phase === "signup" && (
                <>
                  <label htmlFor="account-confirm">Confirm password</label>
                  <input id="account-confirm" name="confirm" type={visible ? "text" : "password"}
                    autoComplete="new-password" placeholder="Repeat your password"
                    minLength={6} maxLength={128} required value={confirm}
                    onChange={e => setConfirm(e.target.value)} disabled={busy} />
                  <small className="auth-password-hint">Use at least 6 characters. Longer passwords are safer.</small>
                </>
              )}
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
        <p className="auth-fineprint">18+ · Your game wallet and bet history stay on this device.</p>
      </section>
    </div>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth requires AuthProvider");
  return value;
}
