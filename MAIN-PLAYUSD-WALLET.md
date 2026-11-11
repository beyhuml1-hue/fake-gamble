# Main Play USD transfers and simulated card details

This update deletes the **separate chat-credit transfer check**. All authenticated user transfers now debit the main server-backed Play USD account and credit the recipient's same account. The private notification and Rain schedule remain. Historical chat balances were already recorded as opening wallet events. This migration **removes the obsolete `community_profiles.cents` column and its triggers entirely**, so transfers, Rain and the UI can only use the Play USD wallet.

A signed-in browser imports its existing local Play USD game balance once. Future local game debits, winnings, Rain and demo-card loads are reflected in one shared server ledger; changes are collected in an idempotent pending queue and synchronized. Accounts on other devices show the server balance. Because game results are still submitted by the browser, these credits remain **simulation-only and are not server-audited casino funds**.

Wallet: a clean card-number, expiry, CVC and name form replaces the voucher. The details match a PlayBlockBet-only simulated card. The global pool begins at $125 and decreases atomically for every successful redemption, regardless of account. The server stores only a SHA-256 fingerprint, not card credentials. The prior voucher route is no longer active. The card is not usable with real merchants, card networks or banks.

**Deploy order:** apply `migrations/0011_main_playusd_wallet.sql`, set `demo_shared_voucher.card_hash` using the SHA-256 of `blockbet-sim-card-v1|NUMBER|MM/YY|CVC`, deploy the latest `blockbet-auth` script, then deploy the frontend. Do not delete historical old chat-credit data or existing demo-card charges.
