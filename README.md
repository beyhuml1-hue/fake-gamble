# Fake Gamble

Play-money casino originals. The balance is **Play USD**, pegged 1:1 to the US dollar. There is no deposit, no withdrawal, and no slots.

## Play

```bash
npm install
npm run dev
```

Open the local URL Vite prints. You start with $1,000.00. Refill or set a practice balance from Wallet. Everything stays in this browser.

## Games

Dice, Mines, Plinko, Crash, Limbo, Keno, Wheel, Hi-Lo, Blackjack, Roulette, Dragon Tower, Flip, and Diamonds. Every table uses the same bet ticket. Games using the shared payout math target a 98% base return before payout rounding. Traditional card tables retain their game-specific rules. Head-to-head player rooms have no house fee. Signed-in browser game wagers and the new card cases return 0.2% wager rakeback and allocate a theoretical 1.8% wager fee to the shared owner wallet.

This is a simulator. It is not a real-money casino and it is not affiliated with any gambling brand.

## Arcade editions

The default build serves the new BlockBet Arcade at `/` and the original game lineup at `/classic/`. Both use the same Play USD wallet on the same origin. Configure SPA fallback to `index.html` for game URLs.

Run `npm run build:classic` for a separate Classic deployment from `dist-classic`. Each deployment that needs account features must serve its existing `functions/` API and D1 binding.
