import { describe, it, expect } from 'vitest'
import { createTable } from '../src/init.js'
import { reduce } from '../src/reducer.js'
import {
  startHand,
  dealCards,
  call,
  raiseTo,
  fold,
  check,
} from '../src/actions.js'
import { expectState } from '../src/testing.js'

describe('betting flow minimal', () => {
  it('P1 raises, P2 calls', () => {
    let table = createTable(2, 1000, 100)
    table = reduce(table, startHand())
    table = reduce(table, dealCards()) // PREFLOP, toAct=0

    table = reduce(table, raiseTo(0, 200)) // P1 raises to 200
    table = reduce(table, call(1)) // P2 calls to 200

    const flop = expectState(table, 'FLOP')
    expect(flop.board).toHaveLength(3)
    expect(flop.pots[0]?.amount).toBe(500)
    expect(flop.players[0].bet).toBe(0)
    expect(flop.players[1].bet).toBe(0)
  })

  it('advances after heads-up flop checks', () => {
    let table = createTable(2, 1000, 100)
    table = reduce(table, startHand())
    table = reduce(table, dealCards())

    table = reduce(table, call(0))
    table = reduce(table, check(1))

    const flop = expectState(table, 'FLOP')
    expect(flop.toAct).toBe(1)

    table = reduce(table, check(1))
    table = reduce(table, check(0))

    const turnHU = expectState(table, 'TURN')
    expect(turnHU.toAct).toBe(1)
  })

  it('closes after heads-up bet and call on the flop', () => {
    let table = createTable(2, 1000, 100)
    table = reduce(table, startHand())
    table = reduce(table, dealCards())

    table = reduce(table, call(0))
    table = reduce(table, check(1))

    table = reduce(table, raiseTo(1, 150))
    table = reduce(table, call(0))

    const turnHU = expectState(table, 'TURN')
    expect(turnHU.toAct).toBe(1)
  })

  it('closes the street when the starter folds mid-round', () => {
    let table = createTable(6, 1000, 100)
    table = reduce(table, startHand())
    table = reduce(table, dealCards())

    for (const action of [
      call(3),
      call(4),
      call(5),
      call(0),
      call(1),
      check(2),
    ]) {
      table = reduce(table, action)
    }

    const flop = expectState(table, 'FLOP')
    expect(flop.toAct).toBe(1)

    table = reduce(table, fold(1))
    table = reduce(table, check(2))
    table = reduce(table, fold(3))
    table = reduce(table, fold(4))
    table = reduce(table, fold(5))
    table = reduce(table, check(0))

    const turn = expectState(table, 'TURN')
    expect(turn.board).toHaveLength(4)
    expect(turn.toAct).toBe(2)
  })

  it('respects new last aggressor after re-raise', () => {
    let table = createTable(3, 2000, 100)
    table = reduce(table, startHand())
    table = reduce(table, dealCards())

    table = reduce(table, call(0))
    table = reduce(table, call(1))
    table = reduce(table, check(2))

    table = reduce(table, raiseTo(1, 200))
    table = reduce(table, raiseTo(2, 400))
    table = reduce(table, raiseTo(0, 800))
    table = reduce(table, fold(1))
    table = reduce(table, call(2))

    const turn = expectState(table, 'TURN')
    expect(turn.toAct).toBe(2)
  })
})
