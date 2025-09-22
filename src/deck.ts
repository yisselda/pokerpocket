import { Card, Rank, Suit } from './types.js'
import { RNG } from './rng.js'

const SUITS: Suit[] = ['s', 'h', 'd', 'c']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

export function shuffle(deck: Card[], rng: RNG): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rng.randInt(i + 1)
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
}

export function draw(deck: Card[], n: number): Card[] {
  if (deck.length < n) {
    throw new Error(`Cannot draw ${n} cards, only ${deck.length} remaining`)
  }
  return deck.splice(0, n)
}