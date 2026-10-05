import { useEffect, useRef, useState } from 'react'
import { ApiError, request, type Balance, type Reward, type Redemption, type RedemptionResult } from './api'
import { clearAttempt, loadAttempt, saveAttempt, type RedemptionAttempt } from './redemptionAttempt'

type Data = { balance: Balance; rewards: Reward[]; history: Redemption[] }
type Route = { page: 'overview' | 'rewards' | 'history'; rewardId?: number }
const points = (value: number) => value.toLocaleString()
const date = (value: string, time = false) => new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', ...(time ? { hour: 'numeric', minute: '2-digit' } : {}) })
const errorMessage = (error: unknown) => error instanceof TypeError ? 'Unable to connect. Check that Rails is running and try again.' : error instanceof Error ? error.message : 'Unable to connect. Check that Rails is running and try again.'
function readRoute(): Route {
  const match = window.location.hash.match(/^#\/rewards(?:\/([1-9]\d*))?$/)
  if (match) return { page: 'rewards', rewardId: match[1] ? Number(match[1]) : undefined }
  return { page: window.location.hash === '#/history' ? 'history' : 'overview' }
}
function photoKind(name: string) {
  const text = name.toLowerCase()
  if (/coffee/.test(text)) return 'coffee'
  if (/pastry|croissant/.test(text)) return 'pastry'
  if (/sandwich/.test(text)) return 'sandwich'
  if (/lunch|two/.test(text)) return 'lunch'
  if (/20/.test(text)) return 'meal'
  return /10/.test(text) ? 'drink' : 'generic'
}
function RewardArt({ name, small = false }: { name: string; small?: boolean }) {
  const kind = photoKind(name)
  return <div aria-hidden="true" className={`reward-art ${kind} ${small ? 'small' : ''}`}>{kind === 'generic' && <span>✧</span>}</div>
}
function Link({ to, children, className = '' }: { to: string; children: React.ReactNode; className?: string }) {
  return <a href={`#/${to}`} className={className}>{children}</a>
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute)
  const [saved] = useState(() => {
    try { return { attempt: loadAttempt(), error: '' } }
    catch { return { attempt: null, error: 'Unable to read the saved redemption. Restore browser storage before redeeming again.' } }
  })
  const [attempt, setAttempt] = useState<RedemptionAttempt | null>(saved.attempt)
  const [storageError, setStorageError] = useState(saved.error)
  const [userId, setUserId] = useState(saved.attempt?.userId ?? '1')
  const [userInput, setUserInput] = useState(saved.attempt?.userId ?? '1')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
  const [redeemError, setRedeemError] = useState('')
  const uncertain = attempt !== null
  const [success, setSuccess] = useState<RedemptionResult | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const navigate = () => {
      const next = readRoute()
      setRoute(next); setSuccess(previous => previous?.redemption.reward_id === next.rewardId ? previous : null); setRedeemError('')
    }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  useEffect(() => { heading.current?.focus(); window.scrollTo(0, 0) }, [route.page, route.rewardId])
  useEffect(() => {
    const controller = new AbortController()
    // This effect starts a new external request when identity or revision changes.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true); setLoadError('')
    Promise.all([
      request<Balance>('/balance', userId, { signal: controller.signal }),
      request<Reward[]>('/rewards', userId, { signal: controller.signal }),
      request<Redemption[]>('/redemptions', userId, { signal: controller.signal }),
    ]).then(([balance, rewards, history]) => {
      if (controller.signal.aborted) return
      setData({ balance, rewards, history })
    }).catch((error: unknown) => { if (!controller.signal.aborted) setLoadError(errorMessage(error)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [userId, revision])

  async function submitAttempt(current: RedemptionAttempt) {
    if (submitting.current) return
    submitting.current = true; setPending(true); setRedeemError('')
    try {
      const result = await request<RedemptionResult>('/redemptions', current.userId, {
        method: 'POST', body: JSON.stringify({ reward_id: current.rewardId }),
        headers: { 'Idempotency-Key': current.key },
      })
      if (!result.redemption || result.redemption.reward_id !== current.rewardId
        || !Number.isSafeInteger(result.redemption.id) || result.redemption.id <= 0
        || !Number.isSafeInteger(result.points_balance) || result.points_balance < 0
        || typeof result.redemption.reward_name !== 'string'
        || !Number.isSafeInteger(result.redemption.points_spent) || result.redemption.points_spent <= 0
        || typeof result.redemption.created_at !== 'string' || !Number.isFinite(Date.parse(result.redemption.created_at))) {
        throw new Error('Unreadable redemption result.')
      }
      clearAttempt(); setAttempt(null); setStorageError(''); setSuccess(result)
      window.location.assign(`#/rewards/${current.rewardId}`)
      // The replay balance is historical. Refresh reads for the current balance.
      setRevision(value => value + 1)
    } catch (error) {
      // Only known API validation/domain errors conclusively reject this write.
      const rejected = error instanceof ApiError && error.status < 500 && [
        'missing_user_header', 'invalid_user_header', 'user_not_found', 'unsupported_media_type',
        'invalid_json', 'invalid_request', 'missing_idempotency_key', 'invalid_idempotency_key',
        'reward_not_found', 'reward_inactive', 'insufficient_points',
      ].includes(error.code)
      if (rejected) {
        try { clearAttempt(); setAttempt(null) }
        catch { setStorageError('Unable to clear the saved redemption. Restore browser storage and retry the saved request.') }
        setRedeemError(errorMessage(error)); setRevision(value => value + 1)
      } else {
        setRedeemError(error instanceof ApiError && error.code === 'idempotency_conflict'
          ? 'The saved request conflicts with another reward. Its key cannot safely be replaced.'
          : 'We couldn’t confirm your redemption. Retry the saved request to safely confirm its result.')
      }
    } finally { submitting.current = false; setPending(false) }
  }

  async function redeem(reward: Reward) {
    if (submitting.current || uncertain || storageError || loading || loadError || !data) return
    let current: RedemptionAttempt
    try {
      // Read again at the action boundary, so an existing saved attempt wins.
      const existing = loadAttempt()
      if (existing) { setAttempt(existing); setUserId(existing.userId); setUserInput(existing.userId); return }
      current = { userId, rewardId: reward.id, key: crypto.randomUUID() }
      saveAttempt(current)
    } catch {
      setStorageError('Unable to save your redemption request. Enable browser storage before redeeming.')
      return
    }
    setAttempt(current)
    await submitAttempt(current)
  }

  const balance = data?.balance.points_balance ?? 0
  const selected = data?.rewards.find(reward => reward.id === route.rewardId)
  const currentSuccess = success?.redemption.reward_id === route.rewardId ? success : null
  const activePage = route.page
  function rewardCard(reward: Reward, overview = false) {
    const shortfall = reward.points_cost - balance
    return <article className="reward-card" key={reward.id}>
      <RewardArt name={reward.name} />
      <div className="reward-content"><div className="reward-title"><h3>{reward.name}</h3><p><strong>{points(reward.points_cost)}</strong> points</p></div>
        {!overview && <p className="description">{reward.description || 'A little something good, on us.'}</p>}
        {shortfall > 0 ? <button className="button" disabled>Need {points(shortfall)} more points</button> : <Link className={`button ${overview ? 'outline' : 'primary'}`} to={`rewards/${reward.id}`}>{overview ? 'View reward' : 'Redeem'}{overview && <span aria-hidden="true"> →</span>}</Link>}
      </div>
    </article>
  }

  return <>
    <header className="site-header"><div className="header-inner">
      <Link to="overview" className="brand">rewards</Link>
      <nav aria-label="Main navigation">{(['overview', 'rewards', 'history'] as const).map(page => <Link key={page} to={page} className={activePage === page ? 'active' : ''}>{page[0].toUpperCase() + page.slice(1)}</Link>)}</nav>
      <details className="identity"><summary><span className="avatar" aria-hidden="true">{data?.balance.name.split(' ').map(part => part[0]).slice(0, 2).join('') || 'U'}</span><span>{data?.balance.name || 'Demo user'}</span><span aria-hidden="true">⌄</span></summary>
        <form onSubmit={event => {
          event.preventDefault()
          if (pending || uncertain || storageError || !/^[1-9]\d*$/.test(userInput) || userInput === userId) return
          setData(null); setSuccess(null); setRedeemError(''); setUserId(userInput)
        }}><p>Demo identity only. Anyone can select an existing user; this is not authentication.</p><label htmlFor="user-id">User ID</label><input id="user-id" value={userInput} onChange={event => setUserInput(event.target.value)} pattern="[1-9][0-9]*" required disabled={pending || uncertain || !!storageError} inputMode="numeric" /><button className="button primary" disabled={pending || uncertain || !!storageError}>Select user</button></form>
      </details>
    </div></header>
    <main>
      {storageError && <div className="notice error" role="alert"><p>{storageError}</p></div>}
      {attempt && !pending && <div className="notice error" role="alert"><p>{redeemError || 'You have an unresolved redemption. Retry the saved request to safely confirm its result.'}</p><button className="button outline" onClick={() => void submitAttempt(attempt)}>Retry saved redemption</button><button className="button outline" disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh balance and history</button></div>}
      {loadError && <div className="notice error" role="alert"><p>{loadError}</p><button className="button outline" disabled={loading} onClick={() => setRevision(value => value + 1)}>Try again</button></div>}
      {loading && <p className="loading" role="status">{data ? 'Refreshing your rewards…' : 'Loading your rewards…'}</p>}
      {!data && !loading && <div className="empty"><h1 ref={heading} tabIndex={-1}>Your rewards are a moment away.</h1><p>Connect to the rewards API and try again.</p></div>}
      {data && route.page === 'overview' && <>
        <div className="page-heading"><h1 ref={heading} tabIndex={-1}>A little thank you, on us.</h1><p>Your points, ready for something good.</p></div>
        <div className="overview-grid"><section className="balance-card"><p>Available points</p><strong>{points(balance)}</strong><p>Choose a reward to redeem your points.</p><Link to="rewards" className="button peach">Explore rewards <span aria-hidden="true">→</span></Link></section>
          <section className="panel latest"><h2>Your latest redemption</h2>{data.history[0] ? <div className="latest-row"><RewardArt name={data.history[0].reward_name} small /><div><h3>{data.history[0].reward_name}</h3><p>{points(data.history[0].points_spent)} points</p><time dateTime={data.history[0].created_at}>{date(data.history[0].created_at)}</time></div></div> : <p className="empty-copy">Your first treat is waiting. Redeem a reward to start your history.</p>}<Link to="history" className="text-link">View history <span aria-hidden="true">→</span></Link></section></div>
        <section className="reach"><h2>Within reach</h2><div className="reward-grid">{data.rewards.filter(reward => reward.points_cost <= balance).slice(0, 3).map(reward => rewardCard(reward, true))}</div>{!data.rewards.some(reward => reward.points_cost <= balance) && <div className="panel empty-copy">{data.rewards.length ? 'Keep collecting points for your next treat.' : 'New rewards will appear here when they’re available.'} <Link to="rewards">Browse rewards →</Link></div>}</section>
      </>}
      {data && route.page === 'rewards' && route.rewardId === undefined && <>
        <div className="heading-row"><div className="page-heading"><h1 ref={heading} tabIndex={-1}>Find your next treat.</h1><p>Choose a reward and make your points count.</p></div><div className="points-badge"><span aria-hidden="true">◎</span><strong>{points(balance)}</strong> points available</div></div>
        <div className="reward-grid">{data.rewards.map(reward => rewardCard(reward))}</div>{!data.rewards.length && <div className="panel empty-copy">No rewards are available right now. Check back soon.</div>}
      </>}
      {data && route.page === 'rewards' && route.rewardId !== undefined && <>
        <Link to="rewards" className="back-link">← Back to rewards</Link>
        <div className="page-heading"><h1 ref={heading} tabIndex={-1}>{currentSuccess ? 'A little good, all yours.' : selected ? /coffee/i.test(selected.name) ? 'Make it a coffee.' : 'Make it a little rewarding.' : 'Reward unavailable.'}</h1></div>
        {currentSuccess ? <section className="panel success" role="status"><span className="success-icon" aria-hidden="true">✓</span><div><h2>{currentSuccess.redemption.reward_name} is yours!</h2><p>{points(currentSuccess.redemption.points_spent)} points redeemed. Balance after this redemption: {points(currentSuccess.points_balance)} points.</p></div><Link className="text-link" to="history">View redemption history →</Link></section> : selected ? <div className="confirmation-grid"><section className="feature-reward"><RewardArt name={selected.name} /><div><h2>{selected.name}</h2><p>{selected.description || 'A little something good, on us.'}</p></div></section>
          <section className="panel confirmation"><h2>Confirm redemption</h2><dl><div><dt>Current balance</dt><dd>{points(balance)} points</dd></div><div><dt>Reward cost</dt><dd>{points(selected.points_cost)} points</dd></div><div className="total"><dt>Balance after redemption</dt><dd>{points(Math.max(0, balance - selected.points_cost))} points</dd></div></dl>
            {balance < selected.points_cost && <p role="status" className="shortfall">You need {points(selected.points_cost - balance)} more points for this reward.</p>}
            {redeemError && !uncertain && <p className="inline-error" role="alert">{redeemError}</p>}
            <button className="button primary" onClick={() => void redeem(selected)} disabled={pending || loading || !!loadError || uncertain || !!storageError || balance < selected.points_cost}>{pending ? 'Redeeming…' : `Confirm · ${points(selected.points_cost)} points`}</button>
            <Link to="rewards" className="button outline">Cancel</Link><p className="fine-print">Points are deducted when you confirm.</p>
          </section></div> : <div className="panel empty-copy">This reward is no longer available. <Link to="rewards">Choose another reward →</Link></div>}
      </>}
      {data && route.page === 'history' && <>
        <div className="heading-row"><div className="page-heading"><h1 ref={heading} tabIndex={-1}>Your rewards, remembered.</h1><p>A record of every reward you redeemed.</p></div><div className="history-balance"><p>Available points</p><strong>{points(balance)}</strong><span aria-hidden="true">☆</span></div></div>
        <section className="panel history-panel"><h2>Redemption history</h2>{data.history.length ? <><table><thead><tr><th scope="col">Reward</th><th scope="col">Points used</th><th scope="col">Redeemed on</th></tr></thead><tbody>{data.history.map(entry => <tr key={entry.id}><td><div className="history-reward"><RewardArt name={entry.reward_name} small /><strong>{entry.reward_name}</strong></div></td><td data-label="Points used">{points(entry.points_spent)}</td><td data-label="Redeemed on"><time dateTime={entry.created_at}>{date(entry.created_at, true)}</time></td></tr>)}</tbody></table><p className="history-count">Showing all {data.history.length} redemption{data.history.length === 1 ? '' : 's'} · newest first · times shown in your local timezone</p></> : <p className="empty-copy">No redemptions yet. Your next reward could be your first.</p>}</section>
        <aside className="history-cta"><span aria-hidden="true">♧</span><h2>Ready for your next reward?</h2><Link className="button primary" to="rewards">Browse rewards →</Link></aside>
      </>}
    </main><footer>Made for little moments of good. <span>Demo rewards · User {userId}</span></footer>
  </>
}
