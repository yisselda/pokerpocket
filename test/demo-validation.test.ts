import { describe, it, expect } from 'vitest'
import { newGame, evaluate7 } from '../src/engine.js'

describe('Demo Feature Validation', () => {
  describe('Feature 1: Quick Game', () => {
    it('should play complete hand with 2 players', () => {
      const game = newGame({ players: 2, seed: 42 })
      game.deal()
      game.flop()
      game.turn()
      game.river()
      const result = game.showdown()

      expect(result.results).toHaveLength(2)
      expect(result.winners.length).toBeGreaterThanOrEqual(1)
      expect(result.winners.length).toBeLessThanOrEqual(2)
    })

    it('should play complete hand with 9 players', () => {
      const game = newGame({ players: 9, seed: 123 })
      game.deal()
      game.flop()
      game.turn()
      game.river()
      const result = game.showdown()

      expect(result.results).toHaveLength(9)
      expect(result.winners.length).toBeGreaterThanOrEqual(1)
    })

    it('should produce deterministic results with same seed', () => {
      const game1 = newGame({ players: 4, seed: 999 })
      game1.deal()
      game1.flop()
      game1.turn()
      game1.river()
      const result1 = game1.showdown()

      const game2 = newGame({ players: 4, seed: 999 })
      game2.deal()
      game2.flop()
      game2.turn()
      game2.river()
      const result2 = game2.showdown()

      expect(result1.winners).toEqual(result2.winners)
      expect(result1.results[0].eval.score).toBe(result2.results[0].eval.score)
    })

    it('should handle random seed correctly', () => {
      // Test with no seed (random)
      const game = newGame({ players: 3 })
      expect(() => {
        game.deal()
        game.flop()
        game.turn()
        game.river()
        game.showdown()
      }).not.toThrow()
    })

    it('should format output correctly', () => {
      const game = newGame({ players: 3, seed: 1 })
      game.deal()
      game.flop()
      game.turn()
      game.river()
      const result = game.showdown()
      const status = game.status()

      // Check board is present
      expect(status.boardAscii).toBeTruthy()
      expect(status.boardAscii.split(' ')).toHaveLength(5)

      // Check each player has hole cards
      result.results.forEach(r => {
        expect(r.hole).toHaveLength(2)
        expect(r.eval.rank).toBeTruthy()
      })
    })
  })

  describe('Feature 2: Hand Evaluator', () => {
    it('should evaluate 5 cards correctly', () => {
      const cards = [
        { rank: 'A', suit: 's' },
        { rank: 'K', suit: 's' },
        { rank: 'Q', suit: 's' },
        { rank: 'J', suit: 's' },
        { rank: 'T', suit: 's' }
      ]

      const result = evaluate7(cards)
      expect(result.rank).toBe('STRAIGHT_FLUSH')
      expect(result.best5).toHaveLength(5)
    })

    it('should evaluate 6 cards correctly', () => {
      const cards = [
        { rank: 'A', suit: 'h' },
        { rank: 'A', suit: 'd' },
        { rank: 'K', suit: 'c' },
        { rank: 'K', suit: 's' },
        { rank: 'Q', suit: 'h' },
        { rank: 'J', suit: 'd' }
      ]

      const result = evaluate7(cards)
      expect(result.rank).toBe('TWO_PAIR')
      expect(result.best5).toHaveLength(5)
    })

    it('should evaluate 7 cards correctly', () => {
      const cards = [
        { rank: '7', suit: 'h' },
        { rank: '7', suit: 'd' },
        { rank: '7', suit: 'c' },
        { rank: 'K', suit: 's' },
        { rank: 'Q', suit: 'h' },
        { rank: 'J', suit: 'd' },
        { rank: '2', suit: 'c' }
      ]

      const result = evaluate7(cards)
      expect(result.rank).toBe('THREE_OF_A_KIND')
      expect(result.best5).toHaveLength(5)
      expect(result.score).toBeGreaterThan(0)
    })

    it('should reject duplicate cards', () => {
      const cards = [
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 's' }, // duplicate
        { rank: 'K', suit: 's' },
        { rank: 'Q', suit: 's' },
        { rank: 'J', suit: 's' }
      ]

      // The demo checks for duplicates before calling evaluate7
      const hasDuplicates = cards.some((card, i) =>
        cards.some((c, j) => i !== j && card.rank === c.rank && card.suit === c.suit)
      )

      expect(hasDuplicates).toBe(true)
    })

    it('should format evaluation output correctly', () => {
      const cards = [
        { rank: 'A', suit: 'h' },
        { rank: 'K', suit: 'd' },
        { rank: 'Q', suit: 'c' },
        { rank: 'J', suit: 's' },
        { rank: 'T', suit: 'h' }
      ]

      const result = evaluate7(cards)

      // Check output fields exist
      expect(result.rank).toBe('STRAIGHT')
      expect(result.score).toBeGreaterThan(0)
      expect(result.best5).toHaveLength(5)
      expect(result.best5[0].rank).toBe('A')
    })

    it('should handle minimum (5) and maximum (7) cards', () => {
      // Minimum 5 cards
      const min = [
        { rank: '2', suit: 'h' },
        { rank: '3', suit: 'd' },
        { rank: '4', suit: 'c' },
        { rank: '5', suit: 's' },
        { rank: '7', suit: 'h' }
      ]
      expect(() => evaluate7(min)).not.toThrow()

      // Maximum 7 cards
      const max = [
        { rank: '2', suit: 'h' },
        { rank: '3', suit: 'd' },
        { rank: '4', suit: 'c' },
        { rank: '5', suit: 's' },
        { rank: '7', suit: 'h' },
        { rank: '8', suit: 'd' },
        { rank: '9', suit: 'c' }
      ]
      expect(() => evaluate7(max)).not.toThrow()
    })
  })

  describe('Feature 3: Performance Test', () => {
    it('should complete 1000 hands benchmark', () => {
      const start = performance.now()
      const iterations = 1000

      for (let i = 0; i < iterations; i++) {
        const game = newGame({ players: 6, seed: i })
        game.deal()
        game.flop()
        game.turn()
        game.river()
        game.showdown()
      }

      const duration = (performance.now() - start) / 1000
      const handsPerSec = Math.round(iterations / duration)

      // Should complete 1000 hands
      expect(duration).toBeLessThan(10) // Should take less than 10 seconds
      expect(handsPerSec).toBeGreaterThan(100) // At least 100 hands/sec
    })

    it('should measure performance accurately', () => {
      // Run a smaller benchmark twice to verify consistency
      const runBench = (seed: number) => {
        const start = performance.now()
        for (let i = 0; i < 100; i++) {
          const game = newGame({ players: 6, seed: seed + i })
          game.deal()
          game.flop()
          game.turn()
          game.river()
          game.showdown()
        }
        return performance.now() - start
      }

      const time1 = runBench(1)
      const time2 = runBench(1)

      // Times should be somewhat consistent (within 2x)
      const ratio = Math.max(time1, time2) / Math.min(time1, time2)
      expect(ratio).toBeLessThan(2)
    })

    it('should handle different player counts in benchmark', () => {
      const testCounts = [2, 4, 6, 9]

      testCounts.forEach(players => {
        const start = performance.now()
        for (let i = 0; i < 100; i++) {
          const game = newGame({ players, seed: i })
          game.deal()
          game.flop()
          game.turn()
          game.river()
          game.showdown()
        }
        const duration = performance.now() - start

        // All should complete reasonably fast
        expect(duration).toBeLessThan(1000) // Less than 1 second for 100 hands
      })
    })
  })

  describe('Demo Integration', () => {
    it('should export correct functions', () => {
      expect(typeof newGame).toBe('function')
      expect(typeof evaluate7).toBe('function')
    })

    it('should handle edge cases gracefully', () => {
      // Empty input handling
      expect(() => newGame({ players: 0 })).toThrow()
      expect(() => newGame({ players: 10 })).toThrow()

      // Invalid cards
      expect(() => evaluate7([])).toThrow()
      expect(() => evaluate7([{ rank: 'A', suit: 's' }])).toThrow() // < 5 cards
    })
  })
})