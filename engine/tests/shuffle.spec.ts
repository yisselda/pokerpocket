import { describe, it, expect } from 'vitest'
import { freshDeck, shuffle } from '../src/deck'
import { LcgRng } from '../src/rng'

describe('shuffle', () => {
  it('produces identical order for same seed', () => {
    const deck = freshDeck()
    const rngA = new LcgRng(314)
    const rngB = new LcgRng(314)

    const shuffledA = shuffle(deck, rngA)
    const shuffledB = shuffle(deck, rngB)

    expect(shuffledA).toEqual(shuffledB)
  })

  it('differs when seeds differ', () => {
    const deck = freshDeck()
    const rngA = new LcgRng(1)
    const rngB = new LcgRng(2)

    const shuffledA = shuffle(deck, rngA)
    const shuffledB = shuffle(deck, rngB)

    expect(shuffledA).not.toEqual(shuffledB)
  })

  it('is stable for short decks', () => {
    const rng = new LcgRng(42)
    expect(shuffle(['As'], rng)).toEqual(['As'])
    expect(shuffle([], rng)).toEqual([])
  })
})
