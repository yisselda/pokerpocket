import { describe, it, expect } from 'vitest'
import { evaluateSeven } from '../src/evaluator.js'
import { Card, Rank, Suit } from '../src/types.js'

function makeCard(rank: string, suit: string): Card {
  return { rank: rank as Rank, suit: suit as Suit }
}

describe('Evaluator Rankings', () => {
  it('evaluates royal flush (straight flush A-high)', () => {
    const cards = [
      makeCard('A', 's'),
      makeCard('K', 's'),
      makeCard('Q', 's'),
      makeCard('J', 's'),
      makeCard('T', 's'),
      makeCard('2', 'h'),
      makeCard('3', 'h'),
    ]
    const result = evaluateSeven(cards)
    expect(result.rank).toBe('STRAIGHT_FLUSH')
    expect(result.tiebreak).toEqual([14])
  })

  it('evaluates steel wheel (5-high straight flush)', () => {
    const cards = [
      makeCard('A', 's'),
      makeCard('2', 's'),
      makeCard('3', 's'),
      makeCard('4', 's'),
      makeCard('5', 's'),
      makeCard('K', 'h'),
      makeCard('Q', 'h'),
    ]
    const result = evaluateSeven(cards)
    expect(result.rank).toBe('STRAIGHT_FLUSH')
    expect(result.tiebreak).toEqual([5])
  })

  it('evaluates four of a kind', () => {
    const cards = [
      makeCard('A', 's'),
      makeCard('A', 'h'),
      makeCard('A', 'd'),
      makeCard('A', 'c'),
      makeCard('K', 's'),
      makeCard('Q', 'h'),
      makeCard('J', 'h'),
    ]
    const result = evaluateSeven(cards)
    expect(result.rank).toBe('FOUR_OF_A_KIND')
    expect(result.tiebreak).toEqual([14, 13])
  })

  it('evaluates full house', () => {
    const cards = [
      makeCard('A', 's'),
      makeCard('A', 'h'),
      makeCard('A', 'd'),
      makeCard('K', 's'),
      makeCard('K', 'h'),
      makeCard('Q', 'h'),
      makeCard('J', 'h'),
    ]
    const result = evaluateSeven(cards)
    expect(result.rank).toBe('FULL_HOUSE')
    expect(result.tiebreak).toEqual([14, 13])
  })

  it('evaluates flush', () => {
    const cards = [
      makeCard('A', 's'),
      makeCard('K', 's'),
      makeCard('Q', 's'),
      makeCard('J', 's'),
      makeCard('9', 's'),
      makeCard('2', 'h'),
      makeCard('3', 'h'),
    ]
    const result = evaluateSeven(cards)
    expect(result.rank).toBe('FLUSH')
    expect(result.tiebreak).toEqual([14, 13, 12, 11, 9])
  })

  it('evaluates wheel straight (A-2-3-4-5)', () => {
    const cards = [
      makeCard('A', 's'),
      makeCard('2', 'h'),
      makeCard('3', 'd'),
      makeCard('4', 's'),
      makeCard('5', 'h'),
      makeCard('K', 'h'),
      makeCard('Q', 'h'),
    ]
    const result = evaluateSeven(cards)
    expect(result.rank).toBe('STRAIGHT')
    expect(result.tiebreak).toEqual([5])
  })

  it('evaluates broadway straight (T-J-Q-K-A)', () => {
    const cards = [
      makeCard('A', 's'),
      makeCard('K', 'h'),
      makeCard('Q', 'd'),
      makeCard('J', 's'),
      makeCard('T', 'h'),
      makeCard('2', 'h'),
      makeCard('3', 'h'),
    ]
    const result = evaluateSeven(cards)
    expect(result.rank).toBe('STRAIGHT')
    expect(result.tiebreak).toEqual([14])
  })

  it('evaluates three of a kind', () => {
    const cards = [
      makeCard('A', 's'),
      makeCard('A', 'h'),
      makeCard('A', 'd'),
      makeCard('K', 's'),
      makeCard('Q', 'h'),
      makeCard('J', 'h'),
      makeCard('9', 'h'),
    ]
    const result = evaluateSeven(cards)
    expect(result.rank).toBe('THREE_OF_A_KIND')
    expect(result.tiebreak).toEqual([14, 13, 12])
  })

  it('evaluates two pair', () => {
    const cards = [
      makeCard('A', 's'),
      makeCard('A', 'h'),
      makeCard('K', 'd'),
      makeCard('K', 's'),
      makeCard('Q', 'h'),
      makeCard('8', 'h'),
      makeCard('7', 'c'),
    ]
    const result = evaluateSeven(cards)
    expect(result.rank).toBe('TWO_PAIR')
    expect(result.tiebreak).toEqual([14, 13, 12])
  })

  it('evaluates one pair', () => {
    const cards = [
      makeCard('A', 's'),
      makeCard('A', 'h'),
      makeCard('K', 'd'),
      makeCard('Q', 's'),
      makeCard('8', 'h'),
      makeCard('7', 'h'),
      makeCard('5', 'c'),
    ]
    const result = evaluateSeven(cards)
    expect(result.rank).toBe('ONE_PAIR')
    expect(result.tiebreak).toEqual([14, 13, 12, 8])
  })

  it('evaluates high card', () => {
    const cards = [
      makeCard('A', 's'),
      makeCard('K', 'h'),
      makeCard('Q', 'd'),
      makeCard('J', 's'),
      makeCard('9', 'h'),
      makeCard('7', 'h'),
      makeCard('5', 'h'),
    ]
    const result = evaluateSeven(cards)
    expect(result.rank).toBe('HIGH_CARD')
    expect(result.tiebreak).toEqual([14, 13, 12, 11, 9])
  })

  it('flush tie-break by ranks', () => {
    const cards1 = [
      makeCard('A', 's'),
      makeCard('K', 's'),
      makeCard('Q', 's'),
      makeCard('J', 's'),
      makeCard('9', 's'),
      makeCard('2', 'h'),
      makeCard('3', 'h'),
    ]
    const cards2 = [
      makeCard('A', 'h'),
      makeCard('K', 'h'),
      makeCard('Q', 'h'),
      makeCard('J', 'h'),
      makeCard('8', 'h'),
      makeCard('2', 's'),
      makeCard('3', 's'),
    ]

    const result1 = evaluateSeven(cards1)
    const result2 = evaluateSeven(cards2)

    expect(result1.rank).toBe('FLUSH')
    expect(result2.rank).toBe('FLUSH')
    expect(result1.score > result2.score).toBe(true)
  })

  it('full house compare trips first, then pair', () => {
    const cards1 = [
      makeCard('A', 's'),
      makeCard('A', 'h'),
      makeCard('A', 'd'),
      makeCard('2', 's'),
      makeCard('2', 'h'),
      makeCard('K', 'h'),
      makeCard('Q', 'h'),
    ]
    const cards2 = [
      makeCard('K', 's'),
      makeCard('K', 'h'),
      makeCard('K', 'd'),
      makeCard('A', 's'),
      makeCard('A', 'h'),
      makeCard('Q', 'h'),
      makeCard('J', 'h'),
    ]

    const result1 = evaluateSeven(cards1)
    const result2 = evaluateSeven(cards2)

    expect(result1.rank).toBe('FULL_HOUSE')
    expect(result2.rank).toBe('FULL_HOUSE')
    expect(result1.score > result2.score).toBe(true)
  })
})
