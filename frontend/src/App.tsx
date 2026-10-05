import { useEffect, useRef, useState } from 'react'
import type { Reward } from './api'
import { IdentityMenu } from './components/IdentityMenu'
import { Link } from './components/Link'
import { useRedemption } from './hooks/useRedemption'
import { useRewardsData } from './hooks/useRewardsData'
import { HistoryPage } from './pages/HistoryPage'
import { OverviewPage } from './pages/OverviewPage'
import { RedemptionPage } from './pages/RedemptionPage'
import { RewardsPage } from './pages/RewardsPage'
import { readRoute, type Route } from './routes'

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute)
  const redemption = useRedemption()
  const { userId, data, loading, loadError, refresh, selectUser } =
    useRewardsData(redemption.attempt?.userId ?? '1', redemption.revision)
  const heading = useRef<HTMLHeadingElement>(null)
  const { navigate } = redemption

  useEffect(() => {
    const handleNavigation = () => {
      const next = readRoute()
      setRoute(next)
      navigate(next.rewardId)
    }
    window.addEventListener('hashchange', handleNavigation)
    return () => window.removeEventListener('hashchange', handleNavigation)
  }, [navigate])

  useEffect(() => {
    heading.current?.focus()
    window.scrollTo(0, 0)
  }, [route.page, route.rewardId])

  const balance = data?.balance.points_balance ?? 0
  const redemptionDisabled =
    redemption.identityLocked || loading || !!loadError || !data
  const currentSuccess =
    redemption.success?.redemption.reward_id === route.rewardId
      ? redemption.success
      : null

  async function handleRedeem(reward: Reward) {
    if (redemptionDisabled) return
    const restoredUserId = await redemption.redeem(reward, userId)
    // A saved attempt found at submission time takes priority over demo identity.
    if (restoredUserId) selectUser(restoredUserId)
  }

  function handleSelectUser(nextUserId: string) {
    if (redemption.identityLocked) return
    redemption.reset()
    selectUser(nextUserId)
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link to="overview" className="brand">
            rewards
          </Link>
          <nav aria-label="Main navigation">
            {(['overview', 'rewards', 'history'] as const).map((page) => (
              <Link
                key={page}
                to={page}
                className={route.page === page ? 'active' : ''}
              >
                {page[0].toUpperCase() + page.slice(1)}
              </Link>
            ))}
          </nav>
          <IdentityMenu
            key={userId}
            userId={userId}
            name={data?.balance.name}
            disabled={redemption.identityLocked}
            onSelect={handleSelectUser}
          />
        </div>
      </header>
      <main>
        {redemption.storageError && (
          <div className="notice error" role="alert">
            <p>{redemption.storageError}</p>
          </div>
        )}
        {redemption.attempt && !redemption.pending && (
          <div className="notice error" role="alert">
            <p>
              {redemption.redeemError ||
                'You have an unresolved redemption. Retry the saved request to safely confirm its result.'}
            </p>
            <button
              className="button outline"
              onClick={() => void redemption.retry()}
            >
              Retry saved redemption
            </button>
            <button
              className="button outline"
              disabled={loading}
              onClick={refresh}
            >
              Refresh balance and history
            </button>
          </div>
        )}
        {loadError && (
          <div className="notice error" role="alert">
            <p>{loadError}</p>
            <button
              className="button outline"
              disabled={loading}
              onClick={refresh}
            >
              Try again
            </button>
          </div>
        )}
        {loading && (
          <p className="loading" role="status">
            {data ? 'Refreshing your rewards…' : 'Loading your rewards…'}
          </p>
        )}
        {!data && !loading && (
          <div className="empty">
            <h1 ref={heading} tabIndex={-1}>
              Your rewards are a moment away.
            </h1>
            <p>Connect to the rewards API and try again.</p>
          </div>
        )}
        {data && route.page === 'overview' && (
          <OverviewPage
            balance={balance}
            rewards={data.rewards}
            history={data.history}
            headingRef={heading}
          />
        )}
        {data && route.page === 'rewards' && route.rewardId === undefined && (
          <RewardsPage
            balance={balance}
            rewards={data.rewards}
            headingRef={heading}
          />
        )}
        {data && route.page === 'rewards' && route.rewardId !== undefined && (
          <RedemptionPage
            balance={balance}
            reward={data.rewards.find((reward) => reward.id === route.rewardId)}
            success={currentSuccess}
            pending={redemption.pending}
            uncertain={redemption.uncertain}
            disabled={redemptionDisabled}
            redeemError={redemption.redeemError}
            onRedeem={(reward) => void handleRedeem(reward)}
            headingRef={heading}
          />
        )}
        {data && route.page === 'history' && (
          <HistoryPage
            balance={balance}
            history={data.history}
            headingRef={heading}
          />
        )}
      </main>
      <footer>
        Made for little moments of good.{' '}
        <span>Demo rewards · User {userId}</span>
      </footer>
    </>
  )
}
