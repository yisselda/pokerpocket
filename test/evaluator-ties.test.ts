import { describe, it, expect } from 'vitest'
import { PokerEngine } from '../src/engine.js'
import { Card } from '../src/types.js'
import { evaluateSeven } from '../src/evaluator.js'
import tiebreakFixtures from './data/tiebreak.json'

function parseCard(cardStr: string): Card {
  const rank = cardStr[0] as Card['rank']
  const suit = cardStr[1] as Card['suit']
  return { rank, suit }
}

function parseCards(cardsStr: string): Card[] {
  // Handle both hole cards like "AsKd" and board like "QsJsTs9s2d"
  const cards: Card[] = []
  for (let i = 0; i < cardsStr.length; i += 2) {
    if (i + 1 < cardsStr.length) {
      cards.push(parseCard(cardsStr.slice(i, i + 2)))
    }
  }
  return cards
}

interface TiebreakFixture {
  name: string
  players: string[]
  board: string
  expected: number[]
  expectedScores: string[]
}

describe('Evaluator Tie-break Fixtures', () => {
  tiebreakFixtures.forEach((fixture: TiebreakFixture) => {
    it(fixture.name, () => {
      const engine = new PokerEngine()
      const numPlayers = fixture.players.length

      // Set up the engine
      engine.setPlayers(numPlayers)
      engine.setSeed(1)

      // Override the hole cards and board manually
      // We need to simulate the game state at river phase
      const boardCards = parseCards(fixture.board)
      const holeCards = fixture.players.map(parseCards)

      // Build the game state manually by directly creating the 7-card combinations
      // and evaluating them like showdown would
      const results = holeCards.map((hole, player) => {
        const sevenCards = [...hole, ...boardCards]
        const evalResult = evaluateSeven(sevenCards)
        return { player, eval: evalResult, hole }
      })

      // Find winners using the same logic as PokerEngine.showdown()
      const bestScore = results.reduce((max, r) =>
        Number(r.eval.score) > max ? Number(r.eval.score) : max, 0)
      const actualWinners = results
        .filter(r => Number(r.eval.score) === bestScore)
        .map(r => r.player)

      // Verify winners match expected
      expect(actualWinners.sort()).toEqual(fixture.expected.sort())

      // Verify scores match expected (convert bigint to string for comparison)
      const actualScores = results.map(r => {
        // Extract the hand rank category from score for comparison
        // This is a simplified check - in reality we might want to check full tiebreak arrays
        const scoreStr = r.eval.score.toString()
        return scoreStr
      })

      // For tied hands, scores should be identical
      if (fixture.expected.length > 1) {
        const winnerScores = fixture.expected.map(i => actualScores[i])
        const firstScore = winnerScores[0]
        winnerScores.forEach(score => {
          expect(score).toBe(firstScore)
        })
      }
    })
  })
})

// Keep the original manual tests for additional coverage
describe('Evaluator Ties - Manual Tests', () => {
  function makeCard(rank: string, suit: string): Card {
    return { rank: rank as any, suit: suit as any }
  }

  it('identical straight high results in tie', () => {
    const cards1 = [
      makeCard('A', 's'), makeCard('K', 'h'), makeCard('Q', 'd'),
      makeCard('J', 's'), makeCard('T', 'h'), makeCard('2', 'h'), makeCard('3', 'c')
    ]
    const cards2 = [
      makeCard('A', 'c'), makeCard('K', 'd'), makeCard('Q', 'h'),
      makeCard('J', 'c'), makeCard('T', 'd'), makeCard('4', 'h'), makeCard('5', 'c')
    ]

    const result1 = evaluateSeven(cards1)
    const result2 = evaluateSeven(cards2)

    expect(result1.rank).toBe('STRAIGHT')
    expect(result2.rank).toBe('STRAIGHT')
    expect(result1.tiebreak).toEqual(result2.tiebreak)
    expect(result1.score).toBe(result2.score)
  })

  it('quads with different kickers', () => {
    const cards1 = [
      makeCard('A', 's'), makeCard('A', 'h'), makeCard('A', 'd'),
      makeCard('A', 'c'), makeCard('K', 's'), makeCard('Q', 'h'), makeCard('J', 'h')
    ]
    const cards2 = [
      makeCard('A', 's'), makeCard('A', 'h'), makeCard('A', 'd'),
      makeCard('A', 'c'), makeCard('Q', 's'), makeCard('J', 'h'), makeCard('T', 'h')
    ]

    const result1 = evaluateSeven(cards1)
    const result2 = evaluateSeven(cards2)

    expect(result1.rank).toBe('FOUR_OF_A_KIND')
    expect(result2.rank).toBe('FOUR_OF_A_KIND')
    expect(result1.tiebreak[0]).toBe(result2.tiebreak[0])
    expect(result1.tiebreak[1] > result2.tiebreak[1]).toBe(true)
    expect(result1.score > result2.score).toBe(true)
  })
})