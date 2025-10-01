import { describe, it, expect } from 'vitest'
import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { startHand, dealCards, endRound } from '../src/actions'

describe('dealing', () => {
  it('deals hole then flop/turn/river', () => {
    let s = createTable(2, 1000, 100)
    s = reduce(s, startHand())
    s = reduce(s, dealCards())
    expect(s.tag).toBe('PREFLOP')
    s = reduce(s, endRound()) // -> FLOP
    expect(s.tag === 'FLOP' || s.tag === 'SHOWDOWN').toBeTruthy()
  })
})
