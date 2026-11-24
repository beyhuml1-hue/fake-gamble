# DonutSMP cashier

The wallet displays DSMP in whole units. After the regular site login, account linking opens automatically for someone without a linked Minecraft name. A Java name has no prefix. A Bedrock name begins with a dot. The wallet supplies an exact `/pay onixxnex998` verification command with a random amount from 1 to 100. The verification payment is credited to the wallet. The user must send it from the selected account and within the displayed payment request.

Coinflip uses a server-side result and settles against the DSMP wallet. The other games use practice credits. Existing balances, welcome grants, transfers, and practice-game results never enter the DSMP ledger.

## Deployment

1. Apply `migrations/0027_donut_cashier.sql` to the same D1 binding used for accounts. Deploy the site assets and `blockbet-auth.worker.js`. The cashier routes are under the existing `/api/auth/*` binding.
2. Put a fresh, URL-safe secret of 32 to 128 characters into the Worker secret `DONUT_CASHIER_TOKEN`. Start with `DONUT_CASHIER_ENABLED` and `DONUT_GAMES_ENABLED` disabled. Keep the token out of source control.
3. Install the matching Pay Games 1.13.0 Fabric 26.2 build and Fabric API on the cashier profile. In its `config/paygames-website.properties`, set:

   ```properties
   endpoint=https://playblockbet.com/api/auth/donut-cashier-bridge
   account=onixxnex998
   token=YOUR_MATCHING_WORKER_SECRET
   ```

4. Join DonutSMP as the configured account. In **M → Connections**, enable **Website cashier**. You can also enable **Background 1 FPS**. It limits rendering while the window is unfocused and the cashier stays connected. The same client treats payments as cashier activity instead of running in-game wagers.
5. In a test environment, enable the cashier and verify the server accepts payment amounts in the requested 1–100 range. Check one Java or Bedrock link, one exact deposit, a replay of that receipt, and a withdrawal confirmation. Confirm the off switches work. The site uses a recent heartbeat to decide whether it can show new payment commands.
6. Before enabling DSMP Coinflip, reserve separately funded DSMP for prizes in `donut_game_reserve` and keep sufficient in-game funds for all player balances, pending withdrawals and transfer fees. The reserve starts at zero, and a stake cannot exceed the reserve.

## Reconcile ambiguous payments

Inspect recorded receipts against the host account's server payment history. A rounded amount such as `1M` is recorded for review because the displayed number does not prove the exact amount. Validate the sender, exact amount, and payment time before recording a correction. Keep unmatched receipts until reconciled.

For a withdrawal with no server confirmation, keep the amount reserved. Confirm the transaction from the server's history before marking it paid. Release a claim only after confirming that the client did not send the payment. Claims are not retried automatically.
