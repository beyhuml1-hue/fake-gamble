import { formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";

export function Stats() {
  const { history } = useWallet();
  const wagered = history.reduce((sum, row) => sum + row.wager, 0);
  const returned = history.reduce((sum, row) => sum + row.payout, 0);
  const profit = returned - wagered;
  const wins = history.filter((row) => row.payout > row.wager).length;
  const rate = history.length ? (wins / history.length) * 100 : 0;
  const best = history.reduce((top, row) => (row.payout > top ? row.payout : top), 0);

  const byGame = new Map<string, { bets: number; wager: number; back: number }>();
  for (const row of history) {
    const current = byGame.get(row.game) ?? { bets: 0, wager: 0, back: 0 };
    current.bets += 1;
    current.wager += row.wager;
    current.back += row.payout;
    byGame.set(row.game, current);
  }
  const rows = [...byGame.entries()].sort((a, b) => b[1].wager - a[1].wager);

  return (
    <section className="stats-page">
      <div className="lobby-head">
        <div>
          <h1>Stats</h1>
          <p>Every settled bet on this account.</p>
        </div>
      </div>
      <div className="stat-grid">
        <article>
          <span>Net</span>
          <strong className={profit > 0 ? "pos" : profit < 0 ? "neg" : ""}>{formatUSD(profit)}</strong>
        </article>
        <article>
          <span>Wagered</span>
          <strong>{formatUSD(wagered)}</strong>
        </article>
        <article>
          <span>Returned</span>
          <strong>{formatUSD(returned)}</strong>
        </article>
        <article>
          <span>Win rate</span>
          <strong>{history.length ? `${rate.toFixed(1)}%` : "—"}</strong>
        </article>
        <article>
          <span>Bets</span>
          <strong>{history.length}</strong>
        </article>
        <article>
          <span>Best payout</span>
          <strong>{best ? formatUSD(best) : "—"}</strong>
        </article>
      </div>
      <div className="bets">
        <div className="bets-head">
          <h2>By game</h2>
        </div>
        <div className="bets-scroll">
          <table>
            <thead>
              <tr>
                <th>Game</th>
                <th>Bets</th>
                <th>Wagered</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-row">
                    Stats show up after the first settled bet.
                  </td>
                </tr>
              ) : (
                rows.map(([game, row]) => {
                  const net = row.back - row.wager;
                  return (
                    <tr key={game}>
                      <td>{game}</td>
                      <td>{row.bets}</td>
                      <td>{formatUSD(row.wager)}</td>
                      <td className={net > 0 ? "pos" : net < 0 ? "neg" : ""}>{formatUSD(net)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
