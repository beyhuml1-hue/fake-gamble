# BlockBet accounts — sign-up, email verification, password login

The casino at `playblockbet.com` is hosted on the `fake-gamble` Cloudflare Worker; the separate `blockbet-auth` Worker handles `playblockbet.com/api/auth/*`.

**Sign up:** email + password (6–128 characters) → a six-digit one-time code is emailed → enter code within 10 minutes → account created and session issued.

**Log in:** email + password → seven-day HttpOnly Secure SameSite cookie. No OTP is required for ordinary logins.

**Safety:** passwords never stored in plaintext, never stored in localStorage, and never sent back to the frontend. Each password is HMAC-peppered using the server-only `AUTH_PEPPER` secret and salted separately, then derived using PBKDF2-SHA256 (100,000 iterations, the currently supported maximum in the Workers WebCrypto runtime). Both login and code endpoints are rate-limited. Account creation requires a confirmed email. Code-only authentication is disabled, including for older passwordless accounts.

Existing passwordless accounts can register/set a password by verifying their email again. Existing casino gameplay, wallets and credits are browser-local; authentication alone does not synchronise them to other devices.

## Production config

- Cloudflare D1 database `blockbet-auth`, binding `DB`. Apply migration `migrations/0002_password_auth.sql` to existing databases after `0001`.
- `AUTH_PEPPER`: stable secret (don't change; it invalidates old hashes and sessions).
- `AUTH_FROM_EMAIL`: `login@playblockbet.com` or another sender on the verified Resend domain.
- `RESEND_API_KEY`: a secret on the `blockbet-auth` Worker. Never commit the key.
- `GET /api/auth/status` reports account service readiness.
- Routes: `playblockbet.com/api/auth/*` belongs to `blockbet-auth` without touching the casino Worker.

If sign-up email fails, check Resend's domain verification, sending account restrictions and activity. Logins to previously verified password-based accounts do not depend on email delivery.

**Important:** A site enabling real gambling, deposits or prizes requires substantially stronger age checks, gambling licensing, regulatory review and independent security testing. This login implementation is designed for a browser-local casino simulation only.
