import { describe, it, expect } from 'vitest'
import {
  createTable,
  reduce,
  startHand,
  dealCards,
  endRound,
  toShowdown,
  getLegalActions,
} from '../src/index'

describe('public API integration', () => {
  it('plays through a hand with public API only', () => {
    let s = createTable(2, 1000, 100)
    s = reduce(s, startHand())
    s = reduce(s, dealCards())

    // UI would query legal actions for current player:
    if (s.tag !== 'PREFLOP') throw new Error('PREFLOP expected')
    const legal = getLegalActions(s, s.toAct)
    expect(typeof legal.canFold).toBe('boolean')
    expect(typeof legal.callAmount).toBe('number')

    // Fast-forward to showdown
    s.players.forEach(p => {
      p.bet = 200
      p.stack -= 200
    })
    s = reduce(s, endRound())
    s = reduce(s, endRound())
    s = reduce(s, endRound())
    s = reduce(s, endRound())
    s = reduce(s, toShowdown())
    expect(s.tag).toBe('COMPLETE')
  })
})
