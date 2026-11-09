# BlockBet 3D Coinflip + Live Bets

## Coinflip

`src/games/Flip.tsx` now uses a CSS-perspective **3D coin object** with separate, handcrafted vector face textures:

- `public/coin/heads.svg`: dark gunmetal, chrome rim, green glow, laurel crown, BlockBet B and **HEADS**
- `public/coin/tails.svg`: matching same coin, dice emblem and **TAILS**
- `src/styles.css`: extruded-looking milled edge, face depth, GPU-accelerated rotation with six or seven full turns and a final heads/tails orientation

All existing Flip wagers, payouts, and odds are preserved. The coin animation is a visualisation of the previously selected demo result, not a new randomness mechanism.

The coin is rendered with **CSS 3D and SVG**, not a downloadable GLB/FBX mesh; it is designed to work directly in mobile browsers without a Three.js/WebGL dependency.

## Live Bets

The **Live Bets** table displays community-reported settled **fictional-credit** bets from real signed-in BlockBet sessions, rather than fabricated accounts. It polls the endpoint every five seconds, with a separate **Your bets** view. A new navigation link scrolls to the section.

**Opt-in privacy**: `Share my demo bets` is off by default, and is saved on the player's browser only for that signed-in account. Changing it does not erase already-shared rows. Player labels are pseudonymous server-generated HMAC aliases, not email addresses.

**Backend**: `GET /api/auth/live-bets` reads the latest 30 rows from the D1 `auth_live_bets` table (most recent 24 hours). `POST /api/auth/live-bets` requires an authenticated, non-banned account and an origin-valid JSON request, validates bet data and applies rate limiting. The Worker uses `blockbet-auth` D1 and does not rely on the casino's static Worker.

**Caveat**: Game balances, stakes, and outcomes remain determined by local browser code; the server cannot independently prove their correctness. The feed only shows **user-submitted demo activity**, not verified transactions or peer-to-peer wagering. Never treat these entries as financial facts.

## Production

Apply `migrations/0004_live_bets.sql` to D1 database `blockbet-auth` (creates a new table and index without changing existing account data). Deploy the existing `blockbet-auth` Worker with the updated `functions/api/auth/live-bets.js` handler and the two added routes in `blockbet-auth.worker.js`. Preserve all Worker secrets and D1 bindings.

Deploy `main` to the existing `fake-gamble` Worker to publish the coin assets and new React UI. The independent LARP site is unchanged.

The casino uses simulated play credits only. **No real money, deposits, real-world wagers, or cash prizes** are introduced by this feature.
