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
// Fisher–Yates shuffle; returns a new array
export function shuffle<T>(deck: T[], rng: RNG): T[] {
  const out = [...deck]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.randInt ? rng.randInt(i + 1) : Math.floor(rng.next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function shuffleDeck(rng: RNG): string[] {
  return shuffle(freshDeck(), rng)
}
