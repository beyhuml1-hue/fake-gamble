import { formatMult, formatUSD } from "../lib/money";
import { useWallet } from "../state/wallet";

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function BetsTable() {
  const { history, openFlip } = useWallet();

  return (
    <section className="bets">
      <div className="bets-head">
        <h2>Live bets</h2>
        <span className="live-bets-label">Your bets · Play USD</span>
      </div>
      <div className="bets-scroll" role="region" aria-label="Live bet activity" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Game</th>
              <th>Time</th>
              <th>Wager</th>
              <th>Result</th>
              <th>Payout</th>
            </tr>
          </thead>
          <tbody>
            {openFlip && (
              <tr className="bet-pending">
                <td>Flip · {openFlip.side === "heads" ? "Heads" : "Tails"}</td>
                <td>{formatTime(openFlip.at)}</td>
                <td>{formatUSD(openFlip.wager)}</td>
                <td>Flipping…</td>
                <td>—</td>
              </tr>
            )}
            {history.length === 0 && !openFlip ? (
              <tr>
                <td colSpan={5} className="empty-row">
                  No bets yet.
                </td>
              </tr>
            ) : (
              history.map((row) => {
                const mult = row.wager > 0 ? row.payout / row.wager : 0;
                const win = row.payout > row.wager;
                return (
                  <tr key={row.id}>
                    <td>{row.game}</td>
                    <td>{formatTime(row.at)}</td>
                    <td>{formatUSD(row.wager)}</td>
                    <td className={win ? "pos" : row.payout < row.wager ? "neg" : ""}>{formatMult(mult)}</td>
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
