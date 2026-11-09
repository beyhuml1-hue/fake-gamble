# BlockBet AI Owner — isolated staging project

This branch is **not installed on the production site**. It uses only eight seeded imaginary players and a dedicated test database. Neither the original casino balance nor the site's existing browser-local bet history is connected. There are **no real-money or redeemable payments**.

## What is implemented

- NanoGPT OpenAI-compatible inference (qwen/qwen3.7-flash) via a server-side NANOGPT_API_KEY secret.
- One personality across website chat and Discord. The assistant is clearly labelled as an AI bot, not the human owner.
- Natural language with function calling: player balances, transaction history, UTC day/week/month simulated profit and stats, top winners, suspicious-activity flags, coin grants/removals, random/loyal rewards, bug compensation (requires ticket ID), announcements, reward policy and persistent memory.
- Backend permission checks: player tools restricted to that player's own record; admin tools only for a server-verified test admin or designated Discord owner.
- D1 ledger with atomic balance updates, nonnegative balances, individually capped rewards, a single daily reward budget, unique operation references and an audit log.
- Daily login bonuses, surprise rewards, loyal-player rewards, giveaways, seven-minute simulated Rain rounds and scheduled daily Discord reports (when the Discord bot token and channel are configured).
- Right-side website drawer that can open/close, with Rain at top, imaginary-player selector, @mention suggestions, `@ai` replies, dedicated private AI panel and a separate test admin token. All credentials stay in session memory, never localStorage.
- Standalone Discord Gateway bot that responds to mentions and `@ai`, plus Worker-based announcements and scheduled reports.
- Persistent memories and chat history in D1, independent of Discord or website browser storage.
- Tests with SQLite/D1-compatible mocks, imaginary players and a mocked NanoGPT API.

## Critical security

The NanoGPT key pasted into a chat is **not safe to treat as private**. Revoke it and generate a replacement before live use, ideally with a low spend limit. Never paste the key into Vite, GitHub, Discord, a chat message, or a publicly served HTML file.

The staging Worker requires `STAGING_ACCESS_TOKEN` for all demonstration endpoints. Admin tools additionally require `STAGING_ADMIN_TOKEN`. Discord bot calls require a separate `DISCORD_BRIDGE_SECRET`; the backend itself checks Discord guild and owner IDs. CORS permits only the configured preview origin. The provider key never leaves the Worker except when used in a direct server-side Bearer request to NanoGPT.

## Local testing

1. Copy `ai-owner/.env.example` to a private environment file; fill in newly generated secrets.
2. Create an **isolated** Cloudflare D1 database named `blockbet-ai-owner-test` (never reuse the production auth D1). Apply `ai-owner/schema.sql` to that test DB. The SQL seeds eight imaginary players, starting balances and test bets.
3. Run the standalone `ai-owner/src/worker.mjs` Worker on port 8787 with D1 and the secret bindings.
4. Run `npm ci && VITE_AI_OWNER_STAGING=true VITE_AI_OWNER_STAGING_URL=http://localhost:8787 npm run dev` in the repo root. Configure `STAGING_WEB_ORIGIN=http://localhost:5173` on the Worker. In the opened casino preview, use the right-side Chat button and enter the staging access token.
5. For Discord, `cd ai-owner/discord && npm install && npm start`. Enable Message Content Intent, invite the bot to the configured guild, set the Bot Token, Guild ID and Owner ID, and point it to the staging Worker. Neither token nor NanoGPT key should ever be exposed to clients.
6. Run `node --test ai-owner/tests/*.test.mjs`, `npm test` and `npm run build`.

## Worker deployment configuration

Worker name: `blockbet-ai-owner-staging`
D1 binding: `DB`, pointing to the isolated test database.
Server-only secrets: `NANOGPT_API_KEY`, `STAGING_ACCESS_TOKEN`, `STAGING_ADMIN_TOKEN`, `DISCORD_BRIDGE_SECRET`, `DISCORD_BOT_TOKEN` (after bot setup).
Plain-text bindings: `NANOGPT_MODEL`, `STAGING_WEB_ORIGIN`, `DISCORD_GUILD_ID`, `DISCORD_OWNER_ID`, `DISCORD_ANNOUNCE_CHANNEL_ID`.
Recommended UTC cron triggers: `0 * * * *` (hourly rewards) and `0 8 * * *` (daily reports). Both invoke `scheduled()`.

No production Worker routes, database tables or site balances are modified by the staging branch.

## Production integration prerequisites

**The production casino currently stores balances and histories in the player's browser.** A server-side AI cannot read or audit them authoritatively. Before live activation, move casino wallets and game settlements into a server-side ledger, add real verified-auth integration, design migration/reconciliation, and audit transfers and reward policy. The test demo database must never be copied into production. Discord announcements require the actual Discord application and channel credentials supplied through secure settings, not a public chat.

## Owner examples

- `@ai How many bets did we have today?` (test admin)
- `@ai Give Player123 500 demo coins for helping with a bug.` (test admin, budget capped)
- `@ai Who won the most this week?` (public)
- `@ai Reward five active players 75 coins each.` (test admin)
- `@ai Announce today's leaderboard to Discord.` (test admin; queues if Discord token not configured)
