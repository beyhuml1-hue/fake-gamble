# Homepage carousel, big-win chat and shared simulated voucher

The homepage rotates between player-submitted weekly rankings and your local stats, and is styled after the provided reference with dark surfaces, warm medal borders, compact game covers and a two-column mobile layout. Rankings reset Monday 00:00 UTC. They are derived from **player-submitted demo bets**, not independently verified casino accounting. Empty states are real.

The bottom-right win-highlight toast is removed. A reported big win sends one marked public chat announcement if its net profit is at least $50 at 5x or above, or at least $250 regardless of multiplier. At most three such posts per hour per account. Posts are deduplicated by settled bet ID and labeled **player-reported**. Community messages have a server-written `kind='bigwin'` marker, so ordinary chat cannot forge the automatic appearance.

Plinko now has visual peg-impact sway and bobbing while maintaining genuine sampled 50/50 left/right paths; no hidden guaranteed-win behavior is added to Plinko.

The decorative wallet card is removed. A closed-loop **BlockBet-only demo voucher** can redeem a one-time **shared $125 virtual balance**. D1 serializes redemptions and creates idempotent normal Play USD wallet events. A voucher is not a payment card, cannot be used externally, and cannot withdraw or transfer real money. The voucher code is hashed in D1 and never committed to GitHub. The owner can see the remaining shared pool only when `ADMIN_EMAIL` is configured. Browser game balances still remain per device.

Run migration `0010_demo_voucher_bigwin.sql` before deploying the auth Worker, seed the D1 table with the shared pool amount and SHA-256 of `blockbet-demo-voucher-v1|PBDEMO-XXXX-XXXX`, then deploy the website/API. Test `npm test` and `npm run build`.
