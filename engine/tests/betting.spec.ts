import { describe, it, expect } from 'vitest'
import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { startHand, dealCards, call, raiseTo } from '../src/actions'

describe('betting flow minimal', () => {
  it('P1 raises, P2 calls', () => {
    let table = createTable(2, 1000, 100)
    table = reduce(table, startHand())
    table = reduce(table, dealCards()) // PREFLOP, toAct=0

    table = reduce(table, raiseTo(0, 200)) // P1 raises to 200
    table = reduce(table, call(1)) // P2 calls to 200

    expect(table.tag).toBe('PREFLOP')
    expect(table.players[0].bet).toBeGreaterThan(0)
    expect(table.players[1].bet).toBeGreaterThan(0)
  })
})
