const ranks = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'T',
  'J',
  'Q',
  'K',
  'A',
] as const
const suits = ['s', 'h', 'd', 'c'] as const

export function freshDeck(): string[] {
  const out: string[] = []
  for (const r of ranks) for (const s of suits) out.push(`${r}${s}`)
  return out
}

// In-place Fisher-Yates shuffle
export function shuffleDeck(rng = Math.random): string[] {
  const d = freshDeck()
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}
