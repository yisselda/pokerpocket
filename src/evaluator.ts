import { Card, EvalResult, HandRank, Rank } from './types.js'

const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

const HAND_RANK_CODES: Record<HandRank, number> = {
  STRAIGHT_FLUSH: 8,
  FOUR_OF_A_KIND: 7,
  FULL_HOUSE: 6,
  FLUSH: 5,
  STRAIGHT: 4,
  THREE_OF_A_KIND: 3,
  TWO_PAIR: 2,
  ONE_PAIR: 1,
  HIGH_CARD: 0,
}

function getRankValue(rank: Rank): number {
  return RANK_VALUES[rank]
}

function isFlush(cards: Card[]): boolean {
  const suit = cards[0].suit
  return cards.every(card => card.suit === suit)
}

function getStraightHigh(cards: Card[]): number | null {
  const values = cards.map(c => getRankValue(c.rank))
  const uniqueValues = Array.from(new Set(values)).sort((a, b) => b - a)

  // Need at least 5 unique ranks for a straight
  if (uniqueValues.length < 5) {
    return null
  }

  // Check for regular straights (5 consecutive ranks)
  for (let i = 0; i <= uniqueValues.length - 5; i++) {
    if (uniqueValues[i] - uniqueValues[i + 4] === 4) {
      return uniqueValues[i]
    }
  }

  // Check for wheel straight (A-2-3-4-5)
  if (
    uniqueValues.includes(14) &&
    uniqueValues.includes(5) &&
    uniqueValues.includes(4) &&
    uniqueValues.includes(3) &&
    uniqueValues.includes(2)
  ) {
    return 5
  }

  return null
}

function getRankCounts(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const card of cards) {
    const value = getRankValue(card.rank)
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  return counts
}

function evaluateFive(cards: Card[]): EvalResult {
  if (cards.length !== 5) {
    throw new Error('Must evaluate exactly 5 cards')
  }

  const isFlushHand = isFlush(cards)
  const straightHigh = getStraightHigh(cards)
  const rankCounts = getRankCounts(cards)
  const counts = Array.from(rankCounts.values()).sort((a, b) => b - a)
  const ranks = Array.from(rankCounts.keys()).sort((a, b) => b - a)

  let rank: HandRank
  let tiebreak: number[]

  if (isFlushHand && straightHigh) {
    rank = 'STRAIGHT_FLUSH'
    tiebreak = [straightHigh]
  } else if (counts[0] === 4) {
    rank = 'FOUR_OF_A_KIND'
    const quadRank = ranks.find(r => rankCounts.get(r) === 4)!
    const kicker = ranks.find(r => rankCounts.get(r) === 1)!
    tiebreak = [quadRank, kicker]
  } else if (counts[0] === 3 && counts[1] === 2) {
    rank = 'FULL_HOUSE'
    const tripRank = ranks.find(r => rankCounts.get(r) === 3)!
    const pairRank = ranks.find(r => rankCounts.get(r) === 2)!
    tiebreak = [tripRank, pairRank]
  } else if (isFlushHand) {
    rank = 'FLUSH'
    tiebreak = ranks
  } else if (straightHigh) {
    rank = 'STRAIGHT'
    tiebreak = [straightHigh]
  } else if (counts[0] === 3) {
    rank = 'THREE_OF_A_KIND'
    const tripRank = ranks.find(r => rankCounts.get(r) === 3)!
    const kickers = ranks
      .filter(r => rankCounts.get(r) === 1)
      .sort((a, b) => b - a)
    tiebreak = [tripRank, ...kickers]
  } else if (counts[0] === 2 && counts[1] === 2) {
    rank = 'TWO_PAIR'
    const pairs = ranks
      .filter(r => rankCounts.get(r) === 2)
      .sort((a, b) => b - a)
    const kicker = ranks.find(r => rankCounts.get(r) === 1)!
    tiebreak = [pairs[0], pairs[1], kicker]
  } else if (counts[0] === 2) {
    rank = 'ONE_PAIR'
    const pairRank = ranks.find(r => rankCounts.get(r) === 2)!
    const kickers = ranks
      .filter(r => rankCounts.get(r) === 1)
      .sort((a, b) => b - a)
    tiebreak = [pairRank, ...kickers]
  } else {
    rank = 'HIGH_CARD'
    tiebreak = ranks
  }

  const rankCode = HAND_RANK_CODES[rank]
  const score =
    (BigInt(rankCode) << 40n) |
    (BigInt(tiebreak[0] || 0) << 32n) |
    (BigInt(tiebreak[1] || 0) << 24n) |
    (BigInt(tiebreak[2] || 0) << 16n) |
    (BigInt(tiebreak[3] || 0) << 8n) |
    BigInt(tiebreak[4] || 0)

  return { rank, tiebreak, score, best5: cards }
}

function* combinations<T>(arr: T[], r: number): Generator<T[]> {
  const n = arr.length
  if (r > n) return

  const indices = Array.from({ length: r }, (_, i) => i)
  yield indices.map(i => arr[i])

  while (true) {
    let i = r - 1
    while (i >= 0 && indices[i] === i + n - r) {
      i--
    }
    if (i < 0) return

    indices[i]++
    for (let j = i + 1; j < r; j++) {
      indices[j] = indices[j - 1] + 1
    }
    yield indices.map(i => arr[i])
  }
}

export function evaluateSeven(cards7: Card[]): EvalResult {
  if (cards7.length < 5) {
    throw new Error('Must have at least 5 cards to evaluate')
  }

  if (cards7.length === 5) {
    return evaluateFive(cards7)
  }

  if (cards7.length === 6) {
    let bestResult: EvalResult | null = null
    for (const combo of combinations(cards7, 5)) {
      const result = evaluateFive(combo)
      if (!bestResult || result.score > bestResult.score) {
        bestResult = result
      }
    }
    return bestResult!
  }

  if (cards7.length !== 7) {
    throw new Error('Must evaluate exactly 5, 6, or 7 cards')
  }

  let bestResult: EvalResult | null = null

  for (const combo of combinations(cards7, 5)) {
    const result = evaluateFive(combo)
    if (!bestResult || result.score > bestResult.score) {
      bestResult = result
    }
  }

  return bestResult!
}
