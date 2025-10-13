import type { RNG } from './rng.js'

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
// Fisher–Yates shuffle; mutates provided array
function shuffleInPlace<T>(out: T[], rng: RNG): T[] {
  const hasRandInt = typeof rng.randInt === 'function'
  for (let i = out.length - 1; i > 0; i--) {
    const j = hasRandInt
      ? rng.randInt!(i + 1)
      : Math.floor(rng.next() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

export function shuffle<T>(deck: readonly T[], rng: RNG): T[] {
  return shuffleInPlace([...deck], rng)
}

export function shuffleDeck(rng: RNG): string[] {
  return shuffleInPlace(freshDeck(), rng)
}
