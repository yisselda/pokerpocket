import { describe, it, expect } from 'vitest'
import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { startHand, dealCards, raiseTo, call } from '../src/actions'
import { expectState } from './helpers/state'

function allInAmount(stack: number, currentBet: number) {
  return currentBet + stack // "raise to" final bet = existing bet + remaining stack
}

describe('all-in fast-forward', () => {
  it('heads-up: preflop shove + call fast-forwards to COMPLETE', () => {
    let table = createTable(2, 500, 100)
    table = reduce(table, startHand())
    table = reduce(table, dealCards())
    table = expectState(table, 'PREFLOP')

    // Actor shoves
    const a = table.toAct
    const shoveTo = allInAmount(
      table.players[a].stack,
      table.players[a].bet
    )
    table = reduce(table, raiseTo(a, shoveTo))

    // Opponent calls all-in -> should auto runout and COMPLETE
    const b = table.toAct
    table = reduce(table, call(b))

    table = expectState(table, 'COMPLETE')
    expect(table.winners.length).toBeGreaterThan(0)
  })

  it('3-handed: turn shove + calls fast-forwards to COMPLETE', () => {
    let s = createTable(3, 800, 100)
    s = reduce(s, startHand())
    s = reduce(s, dealCards())
    // quick-n-dirty progress to TURN using raises/calls to auto-close streets
    // preflop: each seat acts once to close
    s = expectState(s, 'PREFLOP')
    s = reduce(s, call(s.toAct))
    s = reduce(s, call(s.toAct))
    s = reduce(s, call(s.toAct)) // should advance to FLOP automatically
    if (s.tag !== 'FLOP' && s.tag !== 'SHOWDOWN')
      throw new Error('expected FLOP or SHOWDOWN')

    if (s.tag === 'FLOP') {
      // check around to move to TURN
      s = reduce(s, call(s.toAct)) // treat as check via call when toCall=0 (your UI would gate this)
      s = reduce(s, call(s.toAct))
      s = reduce(s, call(s.toAct))
      if (s.tag !== 'TURN' && s.tag !== 'SHOWDOWN')
        throw new Error('expected TURN or SHOWDOWN')
    }

    // On TURN, shove + calls
    if (s.tag === 'TURN') {
      const shover = s.toAct
      const shoveTo = allInAmount(
        s.players[shover].stack,
        s.players[shover].bet
      )
      s = reduce(s, raiseTo(shover, shoveTo)) // shover all-in
      s = reduce(s, call(s.toAct)) // player 2 calls
      s = reduce(s, call(s.toAct)) // player 3 calls or folds; if folds, still all-in/live players >=2?
    }

    expect(s.tag).toBe('COMPLETE')
  })
})
