import { describe, it, expect } from 'vitest'
import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { startHand, dealCards, endRound } from '../src/actions'

describe('side pots settlement', () => {
  it('creates main pot from street bets', () => {
    let s = createTable(3, 1000, 100)
    s = reduce(s, startHand())
    s = reduce(s, dealCards())

    // fake some bets for test
    if (s.tag !== 'PREFLOP') throw new Error('expected PREFLOP')
    s.players[0].bet = 100
    s.players[0].stack -= 100
    s.players[1].bet = 300
    s.players[1].stack -= 300
    s.players[2].bet = 500
    s.players[2].stack -= 500

    s = reduce(s, endRound()) // settle bets into pots

    const pots = 'pots' in s ? s.pots : []
    expect(pots.length).toBe(3) // main + 2 sides
    expect(pots.reduce((a, p) => a + p.amount, 0)).toBe(100 + 300 + 500)
  })
})
