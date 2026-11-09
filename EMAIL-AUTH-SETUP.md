# BlockBet sign-up and login

BlockBet now offers separate **Sign up** and **Log in** forms with passwords.

- **Sign up**: email + a password of at least 6 characters, then verify ownership using the six-digit code sent by Resend.
- **Log in**: email + password. Email is not sent for routine logins.
- **Guest**: play locally without an online account.

## Cloudflare production setup

The live casino `playblockbet.com` runs on the **`fake-gamble` Worker**. The dedicated **`blockbet-auth` Worker** serves only the route `playblockbet.com/api/auth/*`. The LARP site has its own separate Worker.

The `blockbet-auth` Worker needs these bindings:

- `DB`: the `blockbet-auth` D1 database, with migrations `0001_email_auth.sql` and `0002_password_auth.sql` applied.
- `AUTH_PEPPER`: secret used for keyed password hashing and session signatures. Do not change or expose it.
- `AUTH_FROM_EMAIL`: an address on the verified sender domain, e.g. `login@playblockbet.com`.
- `RESEND_API_KEY`: an encrypted secret used to send signup codes; or `EMAIL` Cloudflare Email Sending binding.

The `functions/api/auth/` handlers are used by the dedicated `blockbet-auth.worker.js` entrypoint. The Worker must be deployed after code updates; publishing the GitHub frontend alone does not update these API routes.

Check `https://playblockbet.com/api/auth/status` for `enabled: true`. This means the database and signing secret are connected, not that Resend email delivery was tested. Use Resend dashboard → Domains to check verification and → Logs to diagnose rejected sends.

The existing casino games and LARP website remain unchanged. Credits and game history are stored in the browser, not on the server.

See [PASSWORD-ACCOUNTS.md](./PASSWORD-ACCOUNTS.md) and [AUTH-WORKER.md](./AUTH-WORKER.md) for details.
