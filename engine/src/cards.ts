import type { Card, Rank, Suit } from './types.js'

const RANK_PATTERN = /^[2-9TJQKA]$/
const SUIT_PATTERN = /^[shdc]$/

function assertRank(rank: string): asserts rank is Rank {
  if (!RANK_PATTERN.test(rank)) {
    throw new Error(`Invalid card rank: ${rank}`)
  }
}

function assertSuit(suit: string): asserts suit is Suit {
  if (!SUIT_PATTERN.test(suit)) {
    throw new Error(`Invalid card suit: ${suit}`)
  }
}

export function parseCard(code: string): Card {
  if (code.length !== 2) {
    throw new Error(`Invalid card code: ${code}`)
  }
  const rank = code[0]
  const suit = code[1]
  assertRank(rank)
  assertSuit(suit)
  return { rank, suit }
}

export function parseCards(codes: string[]): Card[] {
  return codes.map(parseCard)
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
}

export function toAsciiCard(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`
}

export function toAsciiCards(cards: readonly Card[]): string[] {
  return cards.map(toAsciiCard)
}
