import { describe, it, expect } from 'vitest'
import { PokerEngine } from '../src/engine.js'
import { evaluateSeven } from '../src/evaluator.js'
import { Card } from '../src/types.js'

function cardEquals(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit
}

function cardArrayEquals(a: Card[], b: Card[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort((x, y) => x.rank.localeCompare(y.rank) || x.suit.localeCompare(y.suit))
  const sortedB = [...b].sort((x, y) => x.rank.localeCompare(y.rank) || x.suit.localeCompare(y.suit))
  return sortedA.every((card, i) => cardEquals(card, sortedB[i]))
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length === 0) return []

  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map(combo => [first, ...combo])
  const withoutFirst = combinations(rest, k)

  return [...withFirst, ...withoutFirst]
}

describe('Street Evaluation Invariants', () => {
  it('monotonicity: 7-card >= 6-card >= 5-card scores', () => {
    const engine = new PokerEngine()
    engine.setPlayers(4)
    engine.setSeed(7)

    // Deal hole cards
    engine.deal()

    // Get 5-card scores (flop)
    engine.flop()
    const s5 = engine.showdown().results.map(r => r.eval.score)

    // Reset and get 6-card scores (turn)
    engine.setPlayers(4)
    engine.setSeed(7)
    engine.deal()
    engine.flop()
    engine.turn()
    const s6 = engine.showdown().results.map(r => r.eval.score)

    // Reset and get 7-card scores (river)
    engine.setPlayers(4)
    engine.setSeed(7)
    engine.deal()
    engine.flop()
    engine.turn()
    engine.river()
    const s7 = engine.showdown().results.map(r => r.eval.score)

    // Assert monotonicity: s7[i] >= s6[i] >= s5[i] for all players
    for (let i = 0; i < 4; i++) {
      expect(s7[i] >= s6[i]).toBe(true)
      expect(s6[i] >= s5[i]).toBe(true)
    }

    // Log for visibility
    console.log('Player scores across streets:')
    for (let i = 0; i < 4; i++) {
      console.log(`Player ${i}: Flop=${s5[i]} Turn=${s6[i]} River=${s7[i]}`)
    }
  })

  it('exact 5-card composition: best5 equals all available cards', () => {
    // Create a scenario with exactly 5 cards
    const hole = [
      { rank: 'A' as const, suit: 's' as const },
      { rank: 'K' as const, suit: 'h' as const }
    ]
    const board = [
      { rank: 'Q' as const, suit: 'd' as const },
      { rank: 'J' as const, suit: 'c' as const },
      { rank: 'T' as const, suit: 's' as const }
    ]

    const allCards = [...hole, ...board]
    const result = evaluateSeven(allCards)

    // With exactly 5 cards, best5 must equal those 5 cards (no choice)
    expect(result.best5).toHaveLength(5)
    expect(cardArrayEquals(result.best5, allCards)).toBe(true)

    console.log('5-card test - All cards:', allCards)
    console.log('5-card test - Best5:', result.best5)
    console.log('5-card test - Hand rank:', result.rank)
  })

  it('6 choose 5 correctness: best5 is one of the 6 combinations', () => {
    // Create a scenario with exactly 6 cards
    const hole = [
      { rank: 'A' as const, suit: 's' as const },
      { rank: 'K' as const, suit: 'h' as const }
    ]
    const board = [
      { rank: 'Q' as const, suit: 'd' as const },
      { rank: 'J' as const, suit: 'c' as const },
      { rank: 'T' as const, suit: 's' as const },
      { rank: '2' as const, suit: 'h' as const }
    ]

    const allCards = [...hole, ...board]
    const result = evaluateSeven(allCards)

    // Generate all possible 5-card combinations from the 6 cards
    const allCombinations = combinations(allCards, 5)

    // The chosen best5 must be exactly one of these combinations
    const matchingCombination = allCombinations.find(combo =>
      cardArrayEquals(result.best5, combo)
    )

    expect(matchingCombination).toBeDefined()
    expect(allCombinations).toHaveLength(6) // 6 choose 5 = 6

    console.log('6-card test - All cards:', allCards)
    console.log('6-card test - Best5:', result.best5)
    console.log('6-card test - Hand rank:', result.rank)
    console.log('6-card test - All combinations count:', allCombinations.length)
  })

  it('7 choose 5 correctness: best5 is optimal among all combinations', () => {
    // Create a scenario with 7 cards (full game)
    const hole = [
      { rank: 'A' as const, suit: 's' as const },
      { rank: 'K' as const, suit: 'h' as const }
    ]
    const board = [
      { rank: 'Q' as const, suit: 'd' as const },
      { rank: 'J' as const, suit: 'c' as const },
      { rank: 'T' as const, suit: 's' as const },
      { rank: '9' as const, suit: 'h' as const },
      { rank: '2' as const, suit: 'c' as const }
    ]

    const allCards = [...hole, ...board]
    const result = evaluateSeven(allCards)

    // Generate all possible 5-card combinations from the 7 cards
    const allCombinations = combinations(allCards, 5)

    // Evaluate each combination
    const allResults = allCombinations.map(combo => evaluateSeven(combo))

    // The chosen result should have the highest score among all combinations
    const maxScore = allResults.reduce((max, r) => r.score > max ? r.score : max, 0n)

    expect(result.score).toBe(maxScore)
    expect(allCombinations).toHaveLength(21) // 7 choose 5 = 21

    // The chosen best5 must be exactly one of the combinations that achieve max score
    const optimalCombinations = allCombinations.filter((combo, i) =>
      allResults[i].score === maxScore
    )

    const matchingCombination = optimalCombinations.find(combo =>
      cardArrayEquals(result.best5, combo)
    )

    expect(matchingCombination).toBeDefined()

    console.log('7-card test - All cards:', allCards)
    console.log('7-card test - Best5:', result.best5)
    console.log('7-card test - Hand rank:', result.rank)
    console.log('7-card test - Score:', result.score.toString())
    console.log('7-card test - Max possible score:', maxScore.toString())
    console.log('7-card test - Optimal combinations count:', optimalCombinations.length)
  })

  it('monotonicity with multiple seeds: scores never decrease', () => {
    // Test monotonicity across multiple different seeds to ensure it's not seed-dependent
    const seeds = [1, 42, 123, 999, 2023]

    for (const seed of seeds) {
      const engine = new PokerEngine()
      engine.setPlayers(2)
      engine.setSeed(seed)

      // Deal hole cards
      engine.deal()

      // Get 5-card scores (flop)
      engine.flop()
      const s5 = engine.showdown().results.map(r => r.eval.score)

      // Reset and get 6-card scores (turn)
      engine.setPlayers(2)
      engine.setSeed(seed)
      engine.deal()
      engine.flop()
      engine.turn()
      const s6 = engine.showdown().results.map(r => r.eval.score)

      // Reset and get 7-card scores (river)
      engine.setPlayers(2)
      engine.setSeed(seed)
      engine.deal()
      engine.flop()
      engine.turn()
      engine.river()
      const s7 = engine.showdown().results.map(r => r.eval.score)

      // Assert monotonicity for both players
      for (let i = 0; i < 2; i++) {
        expect(s7[i] >= s6[i]).toBe(true)
        expect(s6[i] >= s5[i]).toBe(true)
      }
    }
  })
})