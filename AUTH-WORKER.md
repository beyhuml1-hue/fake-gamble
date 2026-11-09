# BlockBet authentication Worker

This is a **dedicated Worker** serving only the Cloudflare route `playblockbet.com/api/auth/*`. The original `fake-gamble` Worker continues to serve everything else on `playblockbet.com` and `fake-gamble-larp` remains untouched.

Cloudflare Workers, rather than Pages, serve the live `playblockbet.com` domain. The `functions/api/auth/*.js` handlers are reused by this Worker through the entrypoint `blockbet-auth.worker.js`.

## Bindings

- `DB`: Cloudflare D1 database named `blockbet-auth`, contains the schema in `migrations/0001_email_auth.sql`.
- `AUTH_PEPPER`: 32-byte or longer random secret; keep private and stable.
- `AUTH_FROM_EMAIL`: verified sender e.g. `login@playblockbet.com`.
- `EMAIL`: Cloudflare Email Sending binding **after the sending domain is onboarded**. Or `RESEND_API_KEY` as an alternative email provider.

`GET /api/auth/status` reports database and password-login readiness. Email delivery is separately required for new sign-ups and needs a verified sender domain and a working Resend key.

The Worker can be deployed as an ES module with `blockbet-auth.worker.js` as the main module and the existing six handler files plus `functions/_shared/auth.js` as dependent modules. Add a Workers **Route**, not a Custom Domain, to the existing `playblockbet.com` DNS zone. Cloudflare Workers Routes take precedence over Workers Custom Domains for more specific paths. See [routing documentation](https://developers.cloudflare.com/workers/configuration/routing/routes/).

Email Sending setup: in Cloudflare select **Compute → Email Service → Email Sending → Onboard Domain → playblockbet.com**. Cloudflare Email Sending may require a Workers Paid plan to send to arbitrary addresses. Do not enable a paid plan without explicit authorization.
