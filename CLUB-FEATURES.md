# BlockBet Club — multiplayer, profiles and events

BlockBet Club is available at **/club**. It is a separate server-backed minigame and social layer. It does not change or connect to the local casino Play USD wallet, and has **no deposits, withdrawals, prizes with monetary value, or cash payouts**.

## Features implemented

1. **Community Jackpot:** Two-minute server-run rounds; join with Club Points; published entries and pot; server randomly chooses a weighted winner after a round ends, when the next player requests Club state. Without other players, entries may be refunded effectively by winning their own stake. No invented participation.
2. **Profiles and levels:** Edit handle, emoji avatar and banner; XP earned from Club actions; achievements and level progression.
3. **Daily / weekly leaderboards:** XP earned by registered Club players, not simulated scores.
4. **1v1 coinflip challenges:** Server-backed rooms with matching Club Point stakes, server-side outcome, dual-ledger payouts and spectator result history. Unanswered challenges auto-refund on expiration.
5. **Cosmetics:** Persistent inventory of coin, dice, banner and profile-frame styles. Equipping changes the Club profile display, **not casino game assets**.
6. **Daily missions:** Daily check-in plus claimable pack, duel and jackpot missions with Club Points and XP rewards.
7. **Improved case opening:** Case reels sampled with the actual published item odds; rare reveal animation and item multiplier display. Existing case outcomes and balances continue to use local game logic.
8. **Friends and parties:** Friend requests, acceptance, online presence based on recent activity and private temporary four-person party rosters with shareable invite codes. Parties do not have voice/video.
9. **Weekend tournaments:** Free entry Saturday–Sunday UTC; server-settled duel wins and jackpot wins count towards rankings; prior week's leading scorer earns a cosmetic Champion Frame. No guaranteed real-world prize.
10. **Win animations and highlights:** Animated case reveals, duel wins, and a shareable animated result recap for normal casino wins at **/highlight**. These highlight links embed client-submitted wager/payout data and are explicitly **not verified game replays**.

## Design and trust boundaries

- All multiplayer actions require authenticated accounts, same-origin JSON requests and server-side rate limiting.
- Club Points are a separate D1 ledger with unique operation references and nonnegative-balance database triggers.
- Jackpot winners and duel coin sides are generated using Cloudflare's cryptographic RNG.
- Public player profiles use pseudonyms, not email addresses. No bots or artificial users are inserted.
- Club is polled every five seconds, rather than using persistent WebSocket connections.
- Browser-local casino bet results remain unverified; highlighted wins do not prove a transaction.
- No new payments, real-money gambling or transferable assets have been introduced.

## Deployment

Migrate \`migrations/0006_club.sql\` into the existing \`blockbet-auth\` D1 database before deploying API code.
The dedicated \`blockbet-auth\` Cloudflare Worker exposes \`GET /api/auth/club\` and \`POST /api/auth/club\`; the original \`fake-gamble\` Worker serves the Club React UI and game assets.
Keep existing Worker secrets, login code, chat, other games and the LARP site unchanged.
