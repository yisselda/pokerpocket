import type { RNG } from './rng.js'
import { freshDeck, shuffle as shuffleDeck } from './deck.js'
import { parseCard, parseCards, toAsciiCard } from './cards.js'
import type { Card } from './types.js'

export type { Card } from './types.js'

export function fromString(code: string): Card {
  return parseCard(code)
}

export function toAscii(card: Card): string {
  return toAsciiCard(card)
}

export function createDeck(): Card[] {
  return parseCards(freshDeck())
}

export function shuffle<T>(deck: readonly T[], rng: RNG): T[] {
  return shuffleDeck([...deck], rng)
}
