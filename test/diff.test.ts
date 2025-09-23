import { describe, it, expect } from 'vitest'
import { evaluateSeven } from '../src/evaluator.js'
import { Card, Rank, Suit } from '../src/types.js'
import oracleData from './data/oracle7.json'

interface OracleCase {
  cards: string[]
  rank: string
  high: string
}

function parseCard(cardStr: string): Card {
  const rank = cardStr.slice(0, -1) as Rank
  const suit = cardStr.slice(-1) as Suit
  return { rank, suit }
}

function getRankValue(rank: Rank): number {
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
      return 10
    case 'J':
      return 11
    case 'Q':
      return 12
    case 'K':
      return 13
    case 'A':
      return 14
  }
}

function getHighCardFromHand(hand: Card[], rank: string): Rank {
  if (rank === 'STRAIGHT' || rank === 'STRAIGHT_FLUSH') {
    // For straights, need to handle wheel (A-2-3-4-5) specially
    const values = hand.map(c => getRankValue(c.rank)).sort((a, b) => b - a)
    const uniqueValues = Array.from(new Set(values))

    // Check for wheel straight
    if (
      uniqueValues.includes(14) &&
      uniqueValues.includes(5) &&
      uniqueValues.includes(4) &&
      uniqueValues.includes(3) &&
      uniqueValues.includes(2)
    ) {
      return '5'
    }

    // Regular straight - return highest card
    return hand.find(c => getRankValue(c.rank) === Math.max(...uniqueValues))!
      .rank
  }

  if (
    rank === 'FOUR_OF_A_KIND' ||
    rank === 'FULL_HOUSE' ||
    rank === 'THREE_OF_A_KIND'
  ) {
    // Find the rank that appears most frequently
    const rankCounts = new Map<Rank, number>()
    hand.forEach(card => {
      rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1)
    })

    let maxCount = 0
    let mostFrequentRank: Rank = '2'
    rankCounts.forEach((count, rank) => {
      if (count > maxCount) {
        maxCount = count
        mostFrequentRank = rank
      }
    })

    return mostFrequentRank
  }

  if (rank === 'TWO_PAIR' || rank === 'ONE_PAIR') {
    // Find the highest pair
    const rankCounts = new Map<Rank, number>()
    hand.forEach(card => {
      rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1)
    })

    let highestPairRank: Rank = '2'
    let highestPairValue = 0
    rankCounts.forEach((count, rank) => {
      if (count >= 2) {
        const value = getRankValue(rank)
        if (value > highestPairValue) {
          highestPairValue = value
          highestPairRank = rank
        }
      }
    })

    return highestPairRank
  }

  // HIGH_CARD and FLUSH - return highest card
  const highestCard = hand.reduce((highest, card) => {
    return getRankValue(card.rank) > getRankValue(highest.rank) ? card : highest
  })

  return highestCard.rank
}

describe('Differential tests against oracle', () => {
  it('should match oracle evaluations for all test cases', () => {
    const failures: string[] = []

    for (const testCase of oracleData as OracleCase[]) {
      const cards = testCase.cards.map(parseCard)
      const result = evaluateSeven(cards)

      // Compare primary category
      if (result.rank !== testCase.rank) {
        failures.push(
          `Cards: ${testCase.cards.join(' ')} | Expected: ${testCase.rank}, Got: ${result.rank}`
        )
        continue
      }

      // Compare high card/rank for the hand type
      const actualHigh = getHighCardFromHand(result.best5, result.rank)
      if (actualHigh !== testCase.high) {
        failures.push(
          `Cards: ${testCase.cards.join(' ')} | Rank: ${result.rank} | Expected high: ${testCase.high}, Got: ${actualHigh}`
        )
      }
    }

    if (failures.length > 0) {
      console.log('\\nFailures:')
      failures.forEach(failure => console.log(failure))
    }

    expect(failures).toHaveLength(0)
  })

  it('should evaluate all oracle test cases without errors', () => {
    for (const testCase of oracleData as OracleCase[]) {
      const cards = testCase.cards.map(parseCard)
      expect(() => evaluateSeven(cards)).not.toThrow()
    }
  })

  it('should have valid oracle data format', () => {
    expect(oracleData).toBeInstanceOf(Array)
    expect(oracleData.length).toBeGreaterThan(100)

    for (const testCase of oracleData as OracleCase[]) {
      expect(testCase).toHaveProperty('cards')
      expect(testCase).toHaveProperty('rank')
      expect(testCase).toHaveProperty('high')
      expect(testCase.cards).toHaveLength(7)

      // Verify all cards are valid
      testCase.cards.forEach(cardStr => {
        expect(cardStr).toMatch(/^[2-9TJQKA][shdc]$/)
      })

      // Verify rank is valid
      expect([
        'STRAIGHT_FLUSH',
        'FOUR_OF_A_KIND',
        'FULL_HOUSE',
        'FLUSH',
        'STRAIGHT',
        'THREE_OF_A_KIND',
        'TWO_PAIR',
        'ONE_PAIR',
        'HIGH_CARD',
      ]).toContain(testCase.rank)

      // Verify high card is valid
      expect([
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
      ]).toContain(testCase.high)
    }
  })
})
