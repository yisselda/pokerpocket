import { describe, it, expect } from 'vitest'
import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { startHand, dealCards, endRound, toShowdown } from '../src/actions'
import { expectState } from '../src/testing'

describe('showdown', () => {
  it('returns payouts structure', () => {
    let table = createTable(2, 1000, 100)
    table = reduce(table, startHand())
    table = reduce(table, dealCards())
    // force a pot for test:
    const preflop = expectState(table, 'PREFLOP')
    preflop.players[0].bet = 200
    preflop.players[0].stack -= 200
    preflop.players[1].bet = 200
    preflop.players[1].stack -= 200
    table = preflop
    table = reduce(table, endRound()) // settle bets to pots -> FLOP
    const flop = expectState(table, 'FLOP')
    const [mainPot] = flop.pots
    expect(mainPot?.amount).toBe(400)
    table = reduce(table, endRound()) // -> TURN
    table = reduce(table, endRound()) // -> RIVER
    table = reduce(table, endRound()) // -> SHOWDOWN
    expect(table.tag).toBe('SHOWDOWN')
    table = reduce(table, toShowdown())
    const complete = expectState(table, 'COMPLETE')
    expect(complete.winners.length).toBeGreaterThan(0)
  })
})
