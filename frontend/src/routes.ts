export type Route = {
  page: 'overview' | 'rewards' | 'history'
  rewardId?: number
}

export function readRoute(): Route {
  const match = window.location.hash.match(/^#\/rewards(?:\/([1-9]\d*))?$/)
  if (match) {
    return {
      page: 'rewards',
      rewardId: match[1] ? Number(match[1]) : undefined,
    }
  }
  return { page: window.location.hash === '#/history' ? 'history' : 'overview' }
}
