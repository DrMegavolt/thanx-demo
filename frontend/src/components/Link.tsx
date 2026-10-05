import type { ReactNode } from 'react'

export function Link({
  to,
  children,
  className = '',
}: {
  to: string
  children: ReactNode
  className?: string
}) {
  return (
    <a href={`#/${to}`} className={className}>
      {children}
    </a>
  )
}
