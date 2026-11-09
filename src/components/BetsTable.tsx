import { formatMult, formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";

export function BetsTable() {
  const { history } = useWallet();

  return (
    <section className="bets">
      <div className="bets-head">
        <h2>Your bets</h2>
        <span>USD</span>
      </div>
      <div className="bets-scroll">
        <table>
          <thead>
            <tr>
              <th>Game</th>
              <th>Time</th>
              <th>Wager</th>
              <th>Multiplier</th>
              <th>Payout</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">
                  No settled bets yet.
                </td>
              </tr>
            ) : (
              history.map((row) => {
                const mult = row.wager > 0 ? row.payout / row.wager : 0;
                const win = row.payout > row.wager;
                return (
                  <tr key={row.id}>
                    <td>{row.game}</td>
                    <td>{new Date(row.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td>{formatUSD(row.wager)}</td>
                    <td className={win ? "pos" : "neg"}>{formatMult(mult)}</td>
                    <td className={win ? "pos" : row.payout === row.wager ? "" : "neg"}>{formatUSD(row.payout)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
