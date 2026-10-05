function photoKind(name: string) {
  const text = name.toLowerCase()
  if (/coffee/.test(text)) return 'coffee'
  if (/pastry|croissant/.test(text)) return 'pastry'
  if (/sandwich/.test(text)) return 'sandwich'
  if (/lunch|two/.test(text)) return 'lunch'
  if (/20/.test(text)) return 'meal'
  return /10/.test(text) ? 'drink' : 'generic'
}
export function RewardArt({
  name,
  small = false,
}: {
  name: string
  small?: boolean
}) {
  const kind = photoKind(name)
  return (
    <div
      aria-hidden="true"
      className={`reward-art ${kind} ${small ? 'small' : ''}`}
    >
      {kind === 'generic' && <span>✧</span>}
    </div>
  )
}
