import { describe, it, expect } from 'vitest'
import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { startHand, dealCards, call, raiseTo } from '../src/actions'
import { expectState } from './helpers/state'

describe('betting flow minimal', () => {
  it('P1 raises, P2 calls', () => {
    let table = createTable(2, 1000, 100)
    table = reduce(table, startHand())
    table = reduce(table, dealCards()) // PREFLOP, toAct=0

    table = reduce(table, raiseTo(0, 200)) // P1 raises to 200
    table = reduce(table, call(1)) // P2 calls to 200

    const flop = expectState(table, 'FLOP')
    expect(flop.board).toHaveLength(3)
    expect(flop.pots[0]?.amount).toBe(400)
    expect(flop.players[0].bet).toBe(0)
    expect(flop.players[1].bet).toBe(0)
  })
})
