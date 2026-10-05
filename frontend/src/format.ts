export const points = (value: number) => value.toLocaleString()

export const date = (value: string, time = false) =>
  new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(time ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
