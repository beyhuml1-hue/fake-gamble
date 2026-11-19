# Four-card case opening

Cases now has one price-controlled wrapper: Origin below $50, Aurora from $50, Prismatic from $250 and Obsidian from $1,000. The wrapper is cosmetic. One opening always reveals exactly four different multipliers, and every price uses the same published bundle probabilities. The new cases settle on the server before the reveal, and retry receipts persist through a reload.

The supplied Simey card faces, sparkle GIF and holo texture are stored in public/cards with attribution. The full card face is preserved; multipliers and finishes are shown beneath it. The React implementation follows the supplied color-dodge blend layers, pointer mapping and idle keyframes. Finishes progress from matte through silver, holographic, prismatic and gold etched to a patterned black edition. Pointer glare, foil motion, staggered reveals and a tear-open wrapper respect reduced-motion preferences.

## Economy

The new cases have 98% weighted base return before cent rounding. Signed-in house-game wallet debits and new cases receive 0.2% wager rakeback. Fractions accumulate. The other 1.8% theoretical wager fee is allocated to the shared owner wallet, using the existing Gmail identity until the school identity is registered and verified. These are simulated ledger allocations, not cash payments or a guarantee of realized casino profit. Player match escrow and social transfers are excluded.

The shared payout-math edge is now 2%; Coinflip, racing, Double, RPS and Darts were also adjusted. Traditional card tables retain their game-specific rules, and the separate Packs reel retains its displayed difficulty odds. The new four-card Cases game is separate from that Packs reel.

The two requested owner identities share balance mutations atomically. The school identity can complete normal verified signup later without receiving a second starter balance. Shared identities cannot transfer to or play player matches against each other. Owner authorization remains separate from wallet sharing.

Rain starts at $100 each round; voluntary contributions can grow it. The one-time economy reset expires old escrow and unpaid historic Rain before setting all current account wallets to $1,000. It saves previous balances internally, invalidates sessions and advances wallet generations to reject stale queued operations. Existing local history is retained.

## Account controls

Owner-only controls support set/add/subtract, ban and unban. Balance changes run atomically and are audited. A successful ban revokes the target's sessions. Admin unlock requires an explicitly configured owner identity and the existing owner password. Set ADMIN_EMAIL to the school address and ADMIN_EMAILS to the requested Gmail address. An optional ADMIN_PASSWORD_SHA256 secret can override the old password hash without changing source.

Secret per-player odds manipulation is not included. The old hot-table shortcut is restricted to guest practice and displays a persistent notice.

## Deployment

Apply 0020, 0021, 0023, 0024 and 0025 before deploying the auth Worker. Apply 0022 once after both the new backend and frontend are available. Do not reapply older migrations. 0022 has a durable one-time reset marker and balance snapshots.

Validation: npm test and npm run build, with runtime SQLite tests for payout coverage, retries, cross-user receipts, insufficient balance, owner reward allocation, rebate remainders, shared balances, admin actions, session revocation and one-time reset. Visual checks cover desktop and a 390-pixel mobile viewport.
