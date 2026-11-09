# BlockBet 3D Coinflip + Live Bets

## Coinflip

Coinflip uses the **existing gold coin artwork** `public/covers/cover-flip.jpg` from the site's original Flip cover. The spinning coin crops that exact artwork onto both faces and overlays simple gold embossed **HEADS** and **TAILS** labels. The animation uses a lightweight 3D CSS rotation and works on phones without a WebGL renderer or external CDN. The game's wagering and result logic are unchanged.

## Live Bets

The **Live Bets** table displays community-reported settled **fictional-credit** bets from real signed-in BlockBet sessions, rather than fabricated accounts. It polls the endpoint every five seconds, with a separate **Your bets** view. A new navigation link scrolls to the section.

Settled bets from signed-in accounts publish automatically under pseudonymous player labels. Guest bets stay on the device.

**Backend**: `GET /api/auth/live-bets` reads the latest 30 rows from the D1 `auth_live_bets` table (most recent 24 hours). `POST /api/auth/live-bets` requires an authenticated, non-banned account and an origin-valid JSON request, validates bet data and applies rate limiting. The Worker uses `blockbet-auth` D1 and does not rely on the casino's static Worker.

**Caveat**: Game balances, stakes, and outcomes remain determined by local browser code; the server cannot independently prove their correctness. The feed only shows **user-submitted demo activity**, not verified transactions or peer-to-peer wagering. Never treat these entries as financial facts.

## Production

Apply `migrations/0004_live_bets.sql` to D1 database `blockbet-auth` (creates a new table and index without changing existing account data). Deploy the existing `blockbet-auth` Worker with the updated `functions/api/auth/live-bets.js` handler and the two added routes in `blockbet-auth.worker.js`. Preserve all Worker secrets and D1 bindings.

Deploy `main` to the existing `fake-gamble` Worker to publish the coin assets and new React UI. The independent LARP site is unchanged.

The casino uses simulated play credits only. **No real money, deposits, real-world wagers, or cash prizes** are introduced by this feature.

## Community chat and Rain

Apply `migrations/0005_community.sql` after migration 0004. Deploy the auth Worker with `functions/api/auth/community.js` and the updated route table, preserving the existing secrets and bindings.

Signed-in players can post messages, view pseudonymous profiles, and send Play USD from their chat balance. Chat balances start at $0 and are separate from browser game wallets. Rain opens a round every seven minutes. Players must join each round, and their shares are credited when they next open or refresh chat after the round ends.
