# BlockBet chat + normal Play USD rewards

This update removes the standalone Mines Battles multiplayer page, routes, server handler and UI, while keeping the original single-player Mines game. Historical battle database migration remains intact to avoid destroying data.

## Community and wallet
- Every signed-in, non-banned player can post public chat messages and use @mentions. No admin role is required to chat.
- The existing seven-minute $10 Rain requires an explicit Join. At settlement, D1 creates a persistent, unique `rain` event for each recipient.
- Transfer records create corresponding `sent` and `received` wallet events and an unread recipient notification. The database's original trigger still guards against sending more than the sender's **server-held transferable credit reserve**, which consists of Rain and previous incoming transfers.
- The frontend polls `/api/auth/wallet-events` every six seconds even when chat is closed. Each event has an increasing database cursor and is applied once to the signed-in user's **normal game Play USD balance on this device**. It isn't credited to a second chat-only wallet.
- Existing unspent chat balances are imported as one-time opening credits when the migration runs. A receiver sees a toast with the sender name and amount, which they can dismiss.
- Player profiles show public reported wagers, gross positive bet results, gross losses, net result, wins/losses and bet count from submitted `auth_live_bets` records. **These are client-reported results, not independently audited, and records are automatically pruned**, so they do not represent a guaranteed complete lifetime history.
- Messages and transfer records remain server-backed. `@ai` still needs separate production AI endpoint configuration.

## Important wallet limitations
Game wallet balances and bet outcomes are still stored in browser-local storage, not an authoritative server-side ledger. This means:
- **Only Rain and received-transfer funds are transferable** through the authenticated backend, subject to both the on-device game balance and the server-held transferable reserve.
- Social credits are synced once **per browser wallet**, not across a single cross-device balance. Do not present this as real money or production-grade asset accounting.
- A full authoritative cross-device casino wallet would require reworking all game result processing, validation and debit/credit logic on the backend.
- No cryptocurrency, deposits, withdrawals, external payments or real-money transfer functionality is created.

## Deployment order
1. Apply `migrations/0009_community_wallet_sync.sql` to the existing auth D1 database.
2. Deploy the `blockbet-auth` Worker with the `GET` and `POST /api/auth/wallet-events` routes and the updated chat endpoints. Preserve existing bindings/secrets.
3. Deploy the Vite site. Run `npm test`, `npm run build` and test a two-account Rain/transfer/notification scenario.
