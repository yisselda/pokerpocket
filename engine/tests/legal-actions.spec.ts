import { describe, it, expect } from 'vitest'
import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { startHand, dealCards, call } from '../src/actions'
import { getLegalActions } from '../src/selectors'
import { expectState } from './helpers/state'

describe('getLegalActions callAmount', () => {
  it('reports chips required to call', () => {
    let table = createTable(3, 1000, 100)
    table = reduce(table, startHand())
    table = reduce(table, dealCards())

    let betting = expectState(table, 'PREFLOP')
    const utg = getLegalActions(betting, betting.toAct)
    expect(utg.canCall).toBe(true)
    expect(utg.callAmount).toBe(100)

    table = reduce(table, call(betting.toAct))

    betting = expectState(table, 'PREFLOP')
    const sb = getLegalActions(betting, betting.toAct)
    expect(sb.canCall).toBe(true)
    expect(sb.callAmount).toBe(50)

    table = reduce(table, call(betting.toAct))

    betting = expectState(table, 'PREFLOP')
    const bb = getLegalActions(betting, betting.toAct)
    expect(bb.canCall).toBe(false)
    expect(bb.callAmount).toBe(0)
  })
})
