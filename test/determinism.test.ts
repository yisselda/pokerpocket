import { describe, it, expect } from 'vitest'
import { PokerEngine } from '../src/engine.js'
import { createDeck, shuffle } from '../src/deck.js'
import { LCG } from '../src/rng.js'
import { Card } from '../src/types.js'

/**
 * Play a complete hand from deal to showdown
 * @param seed Random seed for reproducibility
 * @param players Number of players (default 5)
 * @returns Array of score strings for comparison
 */
function play(seed: number, players: number = 5): string[] {
  const engine = new PokerEngine()
  engine.setPlayers(players)
  engine.setSeed(seed)

  // Complete hand sequence
  engine.deal()
  engine.flop()
  engine.turn()
  engine.river()

  const showdown = engine.showdown()
  return showdown.results.map(r => r.eval.score.toString())
}

describe('Determinism tests', () => {
  it('same seed produces same scores', () => {
    const seed = 42
    const result1 = play(seed)
    const result2 = play(seed)

    expect(result1).toEqual(result2)
    expect(result1.length).toBe(5) // Default 5 players
  })

  it('same seed with same players always produces identical results', () => {
    const seed = 12345
    const result1 = play(seed, 3)
    const result2 = play(seed, 3)
    const result3 = play(seed, 3)

    // Multiple runs with same seed and same player count should be identical
    expect(result1).toEqual(result2)
    expect(result2).toEqual(result3)
    expect(result1.length).toBe(3)
  })

  it('different seeds usually produce different results', () => {
    const result1 = play(42)
    const result2 = play(43)

    // Different seeds should produce different results (not guaranteed but extremely likely)
    expect(result1).not.toEqual(result2)
  })

  it('multiple seed pairs show consistent differences', () => {
    // Test several seed pairs to ensure deterministic differences
    const pairs = [
      [100, 101],
      [200, 201],
      [300, 301],
      [400, 401],
      [500, 501],
    ]

    for (const [seed1, seed2] of pairs) {
      const result1a = play(seed1)
      const result1b = play(seed1) // Same seed again
      const result2 = play(seed2) // Different seed

      // Same seed should always match
      expect(result1a).toEqual(result1b)

      // Different seeds should (almost certainly) differ
      expect(result1a).not.toEqual(result2)
    }
  })

  it('shuffle produces uniform distribution over many trials', () => {
    // Track frequency of each card appearing first after shuffle
    const cardCounts = new Map<string, number>()
    const numTrials = 1000

    for (let i = 0; i < numTrials; i++) {
      const deck = createDeck()
      const rng = new LCG()
      rng.seed(i) // Different seed each time

      shuffle(deck, rng)

      const firstCard = deck[0]
      const cardKey = `${firstCard.rank}${firstCard.suit}`
      cardCounts.set(cardKey, (cardCounts.get(cardKey) || 0) + 1)
    }

    // Should have exactly 52 different cards
    expect(cardCounts.size).toBe(52)

    // Each card should appear as first card between 2 and 50 times out of 1000
    // (Loose bounds - with true randomness, expect ~19 per card with some variance)
    for (const [card, count] of cardCounts) {
      expect(count).toBeGreaterThanOrEqual(2)
      expect(count).toBeLessThanOrEqual(50)
    }

    // Sanity check: total should equal number of trials
    const totalCounts = Array.from(cardCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    )
    expect(totalCounts).toBe(numTrials)
  })

  it('same sequence produces identical intermediate states', () => {
    const seed = 99999

    // Play two identical sequences step by step
    const engine1 = new PokerEngine()
    const engine2 = new PokerEngine()

    // Setup
    engine1.setPlayers(3)
    engine1.setSeed(seed)
    engine2.setPlayers(3)
    engine2.setSeed(seed)

    // Deal
    engine1.deal()
    engine2.deal()

    // Check hole cards are identical
    for (let player = 0; player < 3; player++) {
      const hole1 = engine1.getHoleCards(player)
      const hole2 = engine2.getHoleCards(player)
      expect(hole1).toEqual(hole2)
    }

    // Flop
    engine1.flop()
    engine2.flop()

    const status1 = engine1.status()
    const status2 = engine2.status()
    expect(status1.boardAscii).toBe(status2.boardAscii)
    expect(status1.phase).toBe(status2.phase)

    // Turn
    engine1.turn()
    engine2.turn()

    const status1Turn = engine1.status()
    const status2Turn = engine2.status()
    expect(status1Turn.boardAscii).toBe(status2Turn.boardAscii)

    // River
    engine1.river()
    engine2.river()

    const status1River = engine1.status()
    const status2River = engine2.status()
    expect(status1River.boardAscii).toBe(status2River.boardAscii)

    // Showdown
    const showdown1 = engine1.showdown()
    const showdown2 = engine2.showdown()

    expect(showdown1.results.map(r => r.eval.score.toString())).toEqual(
      showdown2.results.map(r => r.eval.score.toString())
    )
    expect(showdown1.winners).toEqual(showdown2.winners)
  })

  it('LCG produces expected sequence for known seed', () => {
    // Test that our LCG implementation is working as expected
    const rng = new LCG()
    rng.seed(12345)

    // Generate a few numbers and verify they're deterministic
    const sequence1 = [
      rng.next(),
      rng.next(),
      rng.next(),
      rng.next(),
      rng.next(),
    ]

    // Reset and generate again
    rng.seed(12345)
    const sequence2 = [
      rng.next(),
      rng.next(),
      rng.next(),
      rng.next(),
      rng.next(),
    ]

    expect(sequence1).toEqual(sequence2)

    // Verify they're actually different numbers
    const uniqueValues = new Set(sequence1)
    expect(uniqueValues.size).toBeGreaterThan(1) // Should have multiple different values

    // Verify range is [0, 1)
    for (const value of sequence1) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})
