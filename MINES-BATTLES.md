# Mines Battles — real-player demo matches

Standalone new page: `/mines-battles`, linked from the lobby, sidebar, top navigation and existing Mines game.

- Players need a real signed-in BlockBet account.
- Create a room, copy an invite link, or join any waiting opponent.
- Each side plays a **separate 5x5 board** with 5 securely randomly generated mines, stored only on the server.
- Both players reveal tiles simultaneously. First to reveal 8 safe tiles wins, or hitting a mine loses immediately. A game has a 3-minute timer, with the higher score winning on timeout; equal scores draw.
- A room waits 10 minutes for an opponent. The creator can cancel a waiting room.
- Everyone can spectate public games and see results. No simulated players.
- The server verifies all moves and doesn't expose unpicked mines to clients before the round is over.
- Client polls for state every 2.5 seconds; updates are not WebSockets.
- **Matches are free**, with no wager, casino Play USD debit, credit or payout, nor any real-money functionality. No player claims or crypto deposits.
- Persistent D1 table `mines_battle_rooms`, applied via `migrations/0007_mines_battles.sql`; two added routes on `blockbet-auth` Worker.
- Existing Mines, casino games, authentication, Live Bets, chat, and LARP remain intact. **Club remains removed.**

No fabricated activity is inserted into live rooms or results.
