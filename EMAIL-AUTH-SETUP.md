# BlockBet email sign-in (six-digit verification code)

The casino at **playblockbet.com** now includes passwordless email account creation and sign-in, using **Cloudflare Pages Functions + D1 + Resend**.

**Email delivery will not work until you complete these owner-only settings.** The code is already in the repository. When not configured, BlockBet preserves the existing guest experience rather than locking everyone out.

## Configure production in Cloudflare

1. Open **Cloudflare Dashboard → Workers & Pages → the casino's Pages project** (the project serving `playblockbet.com`, not the separate LARP Pages project).
2. Create a **D1 database** (e.g. `blockbet-auth`).
3. Open the database's **Console** and execute all statements from [`migrations/0001_email_auth.sql`](./migrations/0001_email_auth.sql). Alternatively use Wrangler: `npx wrangler d1 execute blockbet-auth --remote --file=./migrations/0001_email_auth.sql`.
4. In the casino Pages project, add a **D1 binding** named **`DB`** pointing at your new database. Bind it in **Production** (and optionally Preview). Redeploy for bindings to take effect.
5. Create an account at [Resend](https://resend.com), **verify your sending domain** (such as `playblockbet.com`) with the DNS records Resend supplies, and create an API key.
6. In the same casino Pages project → **Settings → Variables and Secrets**, add:
   - **`RESEND_API_KEY`** — secret value from Resend; *never commit this value*
   - **`AUTH_FROM_EMAIL`** — sender in your verified domain, e.g. `BlockBet <login@playblockbet.com>` (ordinary environment variable is fine)
   - **`AUTH_PEPPER`** — a long random secret you create, e.g. `openssl rand -hex 32`. **Never commit this or change it casually**; changing it invalidates existing codes and sessions.
7. Redeploy the casino Pages project on its `main` branch with **build command `npm run build`**, output directory **`dist`**, repository root as root directory.
8. Test `https://playblockbet.com/api/auth/status` → it should return `{"enabled":true}`. When disabled, the UI offers guest mode and emails are not sent.
9. Test **Sign in → Send 6-digit code → verify email → enter code → sign out → sign in again**.

Cloudflare Pages expects the `functions/` directory at the *repository project root*, **not** in `dist`. Only Git-integrated/Wrangler deployments support these Functions; the deployment must include Functions. See [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/get-started/) and [D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/).

## Behaviour

- Both sign-up and sign-in use the **same six-digit email verification flow**. The first successful verification creates a player account automatically; later verifications sign it in.
- Random codes are generated on the server, **HMAC-hashed** with `AUTH_PEPPER` in D1, expire after **10 minutes**, have **five guesses maximum**, and are consumed after success.
- Code requests are throttled by email and network, with a **60-second cooldown** between sends.
- Sessions use random tokens and **HttpOnly, Secure, SameSite=Lax** cookies, valid for **seven days**; only hashed session tokens are saved in D1.
- Sessions do not expose codes or email-provider keys to frontend JavaScript.
- The casino's existing wallet, history, and fake card balances are still **browser-local** and separated by verified email **on that device**; this addition does **not** add cloud-saved balances, payouts, KYC, payment processing, or an account database for money.

## Owner notes

- Do not share your Resend or `AUTH_PEPPER` keys in chat, GitHub, or browser code. If exposed, rotate immediately.
- Monitor Resend quotas, Cloudflare logs and abuse. D1 `auth_rate` and expired session rows may be cleaned up periodically (e.g. delete `auth_rate` rows with old `window_ms`, expired `auth_sessions` and `auth_otp`).
- Protect age-restricted experiences separately. An email address alone does not verify age, identity, or legal eligibility.
- The auth endpoints are *not* intended to secure real funds: client-local wallet state must never be treated as authoritative for real deposits or withdrawals.
- If you want cross-device game balances and real accounts later, move wallet and bet history to a server-side database with authenticated authorization on every update, and independently audit the design.
