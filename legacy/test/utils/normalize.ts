import { Card, Rank, Suit } from '../../src/types.js'
import { evaluateSeven } from '../../src/evaluator.js'

/**
 * Category mappings between our implementation and poker-evaluator
 *
 * Our categories (0-8):
 * 0: HIGH_CARD
 * 1: ONE_PAIR
 * 2: TWO_PAIR
 * 3: THREE_OF_A_KIND
 * 4: STRAIGHT
 * 5: FLUSH
 * 6: FULL_HOUSE
 * 7: FOUR_OF_A_KIND
 * 8: STRAIGHT_FLUSH
 *
 * poker-evaluator categories (1-9):
 * 1: high card
 * 2: one pair
 * 3: two pairs
 * 4: three of a kind
 * 5: straight
 * 6: flush
 * 7: full house
 * 8: four of a kind
 * 9: straight flush
 */

export const CATEGORY_MAP = {
  // Our -> Name
  ourToName: [
    'HIGH_CARD',
    'ONE_PAIR',
    'TWO_PAIR',
    'THREE_OF_A_KIND',
    'STRAIGHT',
    'FLUSH',
    'FULL_HOUSE',
    'FOUR_OF_A_KIND',
    'STRAIGHT_FLUSH',
  ],
  // Their -> Name
  theirToName: [
    null, // 0 doesn't exist
    'HIGH_CARD',
    'ONE_PAIR',
    'TWO_PAIR',
    'THREE_OF_A_KIND',
    'STRAIGHT',
    'FLUSH',
    'FULL_HOUSE',
    'FOUR_OF_A_KIND',
    'STRAIGHT_FLUSH',
  ],
}

export interface NormalizedEval {
  category: string
  categoryNum: number
  ranks: number[] // normalized rank values for comparison
  best5: Card[]
}

/**
 * Convert rank to normalized value (A=14, K=13, ... 2=2)
 * Handles wheel straight special case
 */
export function getRankValue(rank: Rank | string): number {
  switch (rank) {
    case '2':
      return 2
    case '3':
      return 3
    case '4':
      return 4
    case '5':
      return 5
    case '6':
      return 6
    case '7':
      return 7
    case '8':
      return 8
    case '9':
      return 9
    case 'T':
    case '10':
      return 10
    case 'J':
      return 11
    case 'Q':
      return 12
    case 'K':
      return 13
    case 'A':
      return 14
    default:
      throw new Error(`Invalid rank: ${rank}`)
  }
}

/**
 * Convert our evaluation result to normalized format
 */
export function normalizeOurEval(evalResult: {
  rank: string
  score: bigint
  best5: Card[]
}): NormalizedEval {
  const categoryName = evalResult.rank
  const categoryNum = CATEGORY_MAP.ourToName.indexOf(categoryName)

  // Extract ranks from best5 for comparison
  const ranks = evalResult.best5.map(c => getRankValue(c.rank))

  // Handle wheel straight special case
  if (categoryName === 'STRAIGHT' || categoryName === 'STRAIGHT_FLUSH') {
    const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => b - a)
    if (
      uniqueRanks.includes(14) &&
      uniqueRanks.includes(5) &&
      uniqueRanks.includes(4) &&
      uniqueRanks.includes(3) &&
      uniqueRanks.includes(2)
    ) {
      // Wheel straight - A is low, high card is 5
      return {
        category: categoryName,
        categoryNum,
        ranks: [5, 4, 3, 2, 1], // A is treated as 1 in wheel
        best5: evalResult.best5,
      }
    }
  }

  return {
    category: categoryName,
    categoryNum,
    ranks: ranks.sort((a, b) => b - a),
    best5: evalResult.best5,
  }
}

/**
 * Convert poker-evaluator card format to our format
 * poker-evaluator uses: "As", "2h", "Tc", etc.
 * We use: { rank: 'A', suit: 's' }
 */
export function parsePokerEvaluatorCard(cardStr: string): Card {
  const rank = cardStr.slice(0, -1) as Rank
  const suit = cardStr.slice(-1) as Suit
  return { rank, suit }
}

/**
 * Convert our card format to poker-evaluator format
 */
export function toPokerEvaluatorCard(card: Card): string {
  return `${card.rank}${card.suit}`
}

/**
 * Convert poker-evaluator result to normalized format
 * Result format: { handType: 5, handRank: 1, value: 20481, handName: 'straight' }
 * Note: poker-evaluator doesn't return the best 5 cards, so we need to compute them ourselves
 */
export function normalizeTheirEval(
  result: {
    handType: number
    handRank: number
    handName: string
    value?: number
  },
  originalCards: Card[]
): NormalizedEval {
  const categoryName = CATEGORY_MAP.theirToName[result.handType] || 'UNKNOWN'
  const categoryNum = CATEGORY_MAP.ourToName.indexOf(categoryName)

  // Since poker-evaluator doesn't return best5, we'll use our evaluation for best5
  // This is okay since we're mainly comparing categories and primary ranks
  const ourResult = evaluateSeven(originalCards)
  const best5 = ourResult.best5
  const ranks = best5.map(c => getRankValue(c.rank))

  // Handle wheel straight for poker-evaluator
  if (categoryName === 'STRAIGHT' || categoryName === 'STRAIGHT_FLUSH') {
    const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => b - a)
    if (
      uniqueRanks.includes(14) &&
      uniqueRanks.includes(5) &&
      uniqueRanks.includes(4) &&
      uniqueRanks.includes(3) &&
      uniqueRanks.includes(2)
    ) {
      return {
        category: categoryName,
        categoryNum,
        ranks: [5, 4, 3, 2, 1], // Normalized wheel
        best5,
      }
    }
  }

  return {
    category: categoryName,
    categoryNum,
    ranks: ranks.sort((a, b) => b - a),
    best5,
  }
}

/**
 * Get primary rank(s) for a hand category
 * For pairs/trips/quads: the rank of the paired cards
 * For straights/flushes: the high card
 */
export function getPrimaryRanks(evalResult: NormalizedEval): number[] {
  const { category, ranks } = evalResult

  switch (category) {
    case 'FOUR_OF_A_KIND':
    case 'FULL_HOUSE':
    case 'THREE_OF_A_KIND': {
      // Find the rank that appears most
      const counts = new Map<number, number>()
      ranks.forEach(r => counts.set(r, (counts.get(r) || 0) + 1))
      let maxCount = 0
      let primaryRank = 0
      counts.forEach((count, rank) => {
        if (count > maxCount) {
          maxCount = count
          primaryRank = rank
        }
      })
      return [primaryRank]
    }

    case 'TWO_PAIR': {
      // Find the two pairs
      const counts = new Map<number, number>()
      ranks.forEach(r => counts.set(r, (counts.get(r) || 0) + 1))
      const pairs: number[] = []
      counts.forEach((count, rank) => {
        if (count >= 2) pairs.push(rank)
      })
      return pairs.sort((a, b) => b - a)
    }

    case 'ONE_PAIR': {
      // Find the pair
      const counts = new Map<number, number>()
      ranks.forEach(r => counts.set(r, (counts.get(r) || 0) + 1))
      for (const [rank, count] of counts) {
        if (count >= 2) return [rank]
      }
      return [ranks[0]]
    }

    case 'STRAIGHT':
    case 'STRAIGHT_FLUSH':
      // High card of straight (already normalized for wheel)
      return [Math.max(...ranks)]

    case 'FLUSH':
    case 'HIGH_CARD':
      // Highest card
      return [ranks[0]]

    default:
      return [ranks[0]]
  }
}

/**
 * Compare two normalized evaluations
 * Returns true if they match, false otherwise
 */
export function evalsMatch(
  ours: NormalizedEval,
  theirs: NormalizedEval
): boolean {
  // Categories must match
  if (ours.category !== theirs.category) {
    return false
  }

  // Primary ranks must match
  const ourPrimary = getPrimaryRanks(ours)
  const theirPrimary = getPrimaryRanks(theirs)

  if (ourPrimary.length !== theirPrimary.length) {
    return false
  }

  for (let i = 0; i < ourPrimary.length; i++) {
    if (ourPrimary[i] !== theirPrimary[i]) {
      return false
    }
  }

  return true
}

/**
 * Format a mismatch for logging
 */
export function formatMismatch(
  cards: Card[],
  ours: NormalizedEval,
  theirs: NormalizedEval,
  seed?: number
): string {
  const cardStrs = cards.map(toPokerEvaluatorCard).join(' ')
  const ourPrimary = getPrimaryRanks(ours)
  const theirPrimary = getPrimaryRanks(theirs)

  let output = `\nMismatch found!`
  if (seed !== undefined) output += ` (seed: ${seed})`
  output += `\nCards: ${cardStrs}`
  output += `\nOur eval: ${ours.category} (primary: ${ourPrimary.join(',')})`
  output += `\nTheir eval: ${theirs.category} (primary: ${theirPrimary.join(',')})`

  if (ours.category !== theirs.category) {
    output += `\n  -> Category mismatch!`
  } else {
    output += `\n  -> Primary rank mismatch!`
  }

  return output
}

/**
 * Generate a repro command for a mismatch
 */
export function generateRepro(cards: Card[]): string {
  const cardStrs = cards
    .map(c => `{rank:'${c.rank}',suit:'${c.suit}'}`)
    .join(',')
  return `node -e "const {evaluateSeven}=require('./dist/evaluator.js');console.log(evaluateSeven([${cardStrs}]))"`
}
