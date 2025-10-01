import { describe, it, expect } from 'vitest'
import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { startHand, dealCards } from '../src/actions'

describe('blinds and first to act', () => {
  it('3+ players: UTG acts first preflop, blinds posted', () => {
    let s = createTable(4, 1000, 100)
    s = reduce(s, startHand())
    s = reduce(s, dealCards())
    expect(s.tag).toBe('PREFLOP')
    // BB bet = bigBlind
    expect(s.players[(s.dealer + 2) % 4].bet).toBe(100)
  })
})
