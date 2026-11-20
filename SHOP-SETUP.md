# BlockBet shop (fictional economy)

A new `/shop` page lets signed-in players exchange **fictional Play USD** for **separate store credits**, and use 700 store credits to unlock an **Admin-style cosmetic badge**. Store credits cannot be wagered, transferred, withdrawn or exchanged back. There is no card checkout, payment provider, or real-money deposit.

## Deployment

1. Apply `migrations/0026_shop_credits.sql` to the same Cloudflare D1 database as the account and Play USD tables.
2. Deploy the updated main site and its Cloudflare auth Worker (`blockbet-auth.worker.js`), or Cloudflare Pages Functions if you use that path.
3. Test `/shop` with two separate signed-in accounts: exchange, idempotent order retry, insufficient funds, badge purchase and account isolation.

The exchange is enforced by one SQLite trigger and a single durable receipt. The server, not the browser, sets every price. A duplicate order ID cannot debit a wallet twice.

**Owner/admin permissions do not come with this badge.** They still require the configured `ADMIN_EMAIL`/`ADMIN_EMAILS` and a separate server-verified admin unlock.

To accept actual card payments you would need a supported payment provider, verified server-side payment/webhook reconciliation, refund handling, fraud controls, and a legal/regulatory review for a casino-themed service. Do not connect payments directly to wagerable or transferable Play USD.
