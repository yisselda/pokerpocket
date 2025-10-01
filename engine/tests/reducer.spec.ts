import { describe, it, expect } from 'vitest'
import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { startHand, dealCards, endRound, toShowdown } from '../src/actions'

describe('FSM happy path', () => {
  it('starts at INIT -> DEAL -> PREFLOP', () => {
    let s = createTable(2, 1000, 100)
    expect(s.tag).toBe('INIT')
    s = reduce(s, startHand())
    expect(s.tag).toBe('DEAL')
    s = reduce(s, dealCards())
    expect(s.tag).toBe('PREFLOP')
  })

  it('can progress to SHOWDOWN and COMPLETE (stub)', () => {
    let s = createTable(2, 1000, 100)
    s = reduce(s, startHand())
    s = reduce(s, dealCards())
    s = reduce(s, endRound()) // FLOP
    s = reduce(s, endRound()) // TURN
    s = reduce(s, endRound()) // RIVER
    expect(s.tag === 'RIVER' || s.tag === 'SHOWDOWN').toBeTruthy()
    s = reduce(s, endRound()) // should hit SHOWDOWN
    expect(s.tag).toBe('SHOWDOWN')
    s = reduce(s, toShowdown()) // COMPLETE
    expect(s.tag).toBe('COMPLETE')
  })
})
