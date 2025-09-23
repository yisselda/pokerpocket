import { describe, it, expect } from 'vitest'
import { createDeck, shuffle, draw, drawRandom } from '../src/deck.js'
import { LCG } from '../src/rng.js'

describe('Deck', () => {
  it('creates 52 unique cards', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)

    const cardStrings = deck.map(c => `${c.rank}${c.suit}`)
    const uniqueCards = new Set(cardStrings)
    expect(uniqueCards.size).toBe(52)
  })

  it('Fisher-Yates shuffle changes order', () => {
    const deck1 = createDeck()
    const deck2 = createDeck()
    const rng = new LCG(12345)

    shuffle(deck2, rng)

    const deck1Str = deck1.map(c => `${c.rank}${c.suit}`).join(',')
    const deck2Str = deck2.map(c => `${c.rank}${c.suit}`).join(',')

    expect(deck1Str).not.toBe(deck2Str)
  })

  it('same seed produces identical shuffle order', () => {
    const deck1 = createDeck()
    const deck2 = createDeck()
    const rng1 = new LCG(12345)
    const rng2 = new LCG(12345)

    shuffle(deck1, rng1)
    shuffle(deck2, rng2)

    const deck1Str = deck1.map(c => `${c.rank}${c.suit}`).join(',')
    const deck2Str = deck2.map(c => `${c.rank}${c.suit}`).join(',')

    expect(deck1Str).toBe(deck2Str)
  })

  it('draw returns correct number of cards and mutates deck', () => {
    const deck = createDeck()
    const initialLength = deck.length

    const drawn = draw(deck, 5)

    expect(drawn).toHaveLength(5)
    expect(deck).toHaveLength(initialLength - 5)

    const allCards = [...drawn, ...deck]
    expect(allCards).toHaveLength(52)
  })

  it('draw throws when not enough cards', () => {
    const deck = createDeck()
    expect(() => draw(deck, 53)).toThrow('Cannot draw 53 cards, only 52 remaining')
  })

  describe('drawRandom', () => {
    it('returns correct number of cards', () => {
      const cards5 = drawRandom(5)
      const cards7 = drawRandom(7)

      expect(cards5).toHaveLength(5)
      expect(cards7).toHaveLength(7)
    })

    it('returns unique cards', () => {
      const cards = drawRandom(7)
      const cardStrings = cards.map(c => `${c.rank}${c.suit}`)
      const uniqueCards = new Set(cardStrings)

      expect(uniqueCards.size).toBe(7)
    })

    it('is deterministic with same seed', () => {
      const cards1 = drawRandom(5, 42)
      const cards2 = drawRandom(5, 42)

      const str1 = cards1.map(c => `${c.rank}${c.suit}`).join(',')
      const str2 = cards2.map(c => `${c.rank}${c.suit}`).join(',')

      expect(str1).toBe(str2)
    })

    it('is random without seed', () => {
      const cards1 = drawRandom(5)
      const cards2 = drawRandom(5)

      const str1 = cards1.map(c => `${c.rank}${c.suit}`).join(',')
      const str2 = cards2.map(c => `${c.rank}${c.suit}`).join(',')

      // Very unlikely to be the same
      expect(str1).not.toBe(str2)
    })

    it('works with hand evaluator range (5-7 cards)', () => {
      for (let count = 5; count <= 7; count++) {
        const cards = drawRandom(count)
        expect(cards).toHaveLength(count)

        // All cards should be valid
        cards.forEach(card => {
          expect(['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']).toContain(card.rank)
          expect(['s', 'h', 'd', 'c']).toContain(card.suit)
        })
      }
    })
  })
})