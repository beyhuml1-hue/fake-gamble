# Packs & green gem visuals

- `/game/packs` is a **new** BlockBet game; the existing Cases and all other games are unchanged.
- The supplied silver-pack reference is used as the lobby cover and page preview, scaled from the uploaded image and stored as `public/covers/cover-packs.webp`.
- The supplied transparent green gem is stored as `public/images/gem-green.webp`, scaled for performance, and replaces the old success symbol in Mines and Dragon Tower.
- A white central pointer marks a 7-colour animated reel. A 3.65-second spin resolves to a preselected **weighted** outcome. The animation doesn't change the actual probability.
- Four difficulties: Easy, Medium, Hard, Expert. Red pays 4×, 5×, 6×, 7× respectively; Expert yellow pays **600×** with a 0.10% chance. Exact per-colour chances and expected returns are visible on the game page.
- Payout multipliers include the stake. A bet is taken from the normal fictional Play USD balance; a winning amount returns to that wallet. Results are recorded and submitted to community bets when signed in.
- Maximum bet is constrained by the site's existing maximum balance so that even the top prize can be paid.
- If the player navigates away during a spin, any in-flight wager still settles once (cleanup handles the pending payout).
- All payouts use **fictional credits only**; no money, cryptocurrency or withdrawals.

Test with `npm test` and build with `npm run build`. The two binary assets are optimized versions of the uploaded user references.
