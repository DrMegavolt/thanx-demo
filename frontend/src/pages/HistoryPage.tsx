import type { Ref } from 'react'
import type { Redemption } from '../api'
import { date, points } from '../format'
import { Link } from '../components/Link'
import { RewardArt } from '../components/RewardArt'

type HistoryPageProps = {
  balance: number
  history: Redemption[]
  headingRef: Ref<HTMLHeadingElement>
}

export function HistoryPage({
  balance,
  history,
  headingRef,
}: HistoryPageProps) {
  return (
    <>
      <div className="heading-row">
        <div className="page-heading">
          <h1 ref={headingRef} tabIndex={-1}>
            Your rewards, remembered.
          </h1>
          <p>A record of every reward you redeemed.</p>
        </div>
        <div className="history-balance">
          <p>Available points</p>
          <strong>{points(balance)}</strong>
          <span aria-hidden="true">☆</span>
        </div>
      </div>
      <section className="panel history-panel">
        <h2>Redemption history</h2>
        {history.length ? (
          <>
            <table>
              <thead>
                <tr>
                  <th scope="col">Reward</th>
                  <th scope="col">Points used</th>
                  <th scope="col">Redeemed on</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <div className="history-reward">
                        <RewardArt name={entry.reward_name} small />
                        <strong>{entry.reward_name}</strong>
                      </div>
                    </td>
                    <td data-label="Points used">
                      {points(entry.points_spent)}
                    </td>
                    <td data-label="Redeemed on">
                      <time dateTime={entry.created_at}>
                        {date(entry.created_at, true)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="history-count">
              Showing all {history.length} redemption
              {history.length === 1 ? '' : 's'} · newest first · times shown in
              your local timezone
            </p>
          </>
        ) : (
          <p className="empty-copy">
            No redemptions yet. Your next reward could be your first.
          </p>
        )}
      </section>
      <aside className="history-cta">
        <span aria-hidden="true">♧</span>
        <h2>Ready for your next reward?</h2>
        <Link className="button primary" to="rewards">
          Browse rewards →
        </Link>
      </aside>
    </>
  )
}
