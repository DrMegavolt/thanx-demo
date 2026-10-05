import { useState } from 'react'

type IdentityMenuProps = {
  userId: string
  name?: string
  disabled: boolean
  onSelect: (userId: string) => void
}

export function IdentityMenu({
  userId,
  name,
  disabled,
  onSelect,
}: IdentityMenuProps) {
  const [userInput, setUserInput] = useState(userId)
  const initials =
    name
      ?.split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('') || 'U'

  return (
    <details className="identity">
      <summary>
        <span className="avatar" aria-hidden="true">
          {initials}
        </span>
        <span>{name || 'Demo user'}</span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (disabled || !/^[1-9]\d*$/.test(userInput) || userInput === userId)
            return
          onSelect(userInput)
        }}
      >
        <p>
          Demo identity only. Anyone can select an existing user; this is not
          authentication.
        </p>
        <label htmlFor="user-id">User ID</label>
        <input
          id="user-id"
          value={userInput}
          onChange={(event) => setUserInput(event.target.value)}
          pattern="[1-9][0-9]*"
          required
          disabled={disabled}
          inputMode="numeric"
        />
        <button className="button primary" disabled={disabled}>
          Select user
        </button>
      </form>
    </details>
  )
}
