import { describe, it, expect } from 'vitest'
import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { expectState } from '../src/testing'
import { startHand, dealCards, raiseTo, call, check } from '../src/actions'

describe('closed action auto-advance', () => {
  it('raise then call closes preflop (2-handed)', () => {
    let s = createTable(2, 1000, 100)
    s = reduce(s, startHand())
    s = reduce(s, dealCards())
    const preflop = expectState(s, 'PREFLOP')
    const opener = preflop.toAct

    // toAct is BTN (SB) in HU; BTN opens to 200
    s = reduce(s, raiseTo(opener, 200))

    // BB calls to 200 -> should close and move to FLOP automatically
    const caller = expectState(s, 'PREFLOP').toAct
    s = reduce(s, call(caller))
    expect(['FLOP', 'SHOWDOWN']).toContain(s.tag)
  })

  it('call-call-check closes and advances', () => {
    let s = createTable(3, 1000, 100)
    s = reduce(s, startHand())
    s = reduce(s, dealCards())
    const preflop = expectState(s, 'PREFLOP')

    // Everyone has matched the blinds; allow action to check around
    const first = preflop.toAct
    s = reduce(s, call(first))
    const second = expectState(s, 'PREFLOP').toAct
    s = reduce(s, call(second))
    const third = expectState(s, 'PREFLOP').toAct
    s = reduce(s, check(third))
    expect(['FLOP', 'SHOWDOWN']).toContain(s.tag)
  })

  it('all-in + call closes', () => {
    let s = createTable(2, 200, 100)
    s = reduce(s, startHand())
    s = reduce(s, dealCards())
    const preflop = expectState(s, 'PREFLOP')

    // BTN shoves to all-in
    const shoveSeat = preflop.toAct
    s = reduce(
      s,
      raiseTo(shoveSeat, s.players[shoveSeat].stack + s.players[shoveSeat].bet)
    )

    // BB calls all-in -> should close and go to FLOP/SHOWDOWN, or COMPLETE if the hand is resolved immediately
    const caller = expectState(s, 'PREFLOP').toAct
    s = reduce(s, call(caller))
    expect(['FLOP', 'SHOWDOWN', 'COMPLETE']).toContain(s.tag)
  })
})
