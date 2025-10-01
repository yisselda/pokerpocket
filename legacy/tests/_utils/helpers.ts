import { Card, Rank, Suit } from '../../src/types.js'
import { Rng } from '../../src/engine/betting/types.js'

/**
 * Creates a rigged RNG that returns predetermined cards
 */
export function makeRiggedRng(cards: Card[]): Rng {
  let index = 0
  return {
    draw(count: number): Card[] {
      const result = cards.slice(index, index + count)
      index += count
      if (result.length < count) {
        throw new Error('Not enough cards in rigged deck')
      }
      return result
    },
  }
}

/**
 * Helper to create a card from string notation
 */
export function card(notation: string): Card {
  if (notation.length !== 2) {
    throw new Error('Card notation must be 2 characters (e.g., "As", "2h")')
  }
  const rank = notation[0] as Rank
  const suit = notation[1] as Suit
  return { rank, suit }
}

/**
 * Helper to create multiple cards from string
 */
export function cards(...notations: string[]): Card[] {
  return notations.map(card)
}
