import { describe, it, expect } from 'vitest'
import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { startHand, dealCards, raiseTo, call } from '../src/actions'
import { expectState } from '../src/testing'

function allInAmount(stack: number, currentBet: number) {
  return currentBet + stack // "raise to" final bet = existing bet + remaining stack
}

describe('all-in fast-forward', () => {
  it('heads-up: preflop shove + call fast-forwards to COMPLETE', () => {
    let table = createTable(2, 500, 100)
    table = reduce(table, startHand())
    table = reduce(table, dealCards())
    const preflop = expectState(table, 'PREFLOP')

    // Actor shoves
    const a = preflop.toAct
    const shoveTo = allInAmount(
      preflop.players[a].stack,
      preflop.players[a].bet
    )
    table = reduce(preflop, raiseTo(a, shoveTo))

    // Opponent calls all-in -> should auto runout and COMPLETE
    const preflopAfterRaise = expectState(table, 'PREFLOP')
    const b = preflopAfterRaise.toAct
    table = reduce(preflopAfterRaise, call(b))

    const complete = expectState(table, 'COMPLETE')
    expect(complete.winners.length).toBeGreaterThan(0)
  })

  it('3-handed: turn shove + calls fast-forwards to COMPLETE', () => {
    let s = createTable(3, 800, 100)
    s = reduce(s, startHand())
    s = reduce(s, dealCards())
    // quick-n-dirty progress to TURN using raises/calls to auto-close streets
    // preflop: each seat acts once to close
    let preflop = expectState(s, 'PREFLOP')
    s = reduce(preflop, call(preflop.toAct))
    preflop = expectState(s, 'PREFLOP')
    s = reduce(preflop, call(preflop.toAct))
    preflop = expectState(s, 'PREFLOP')
    s = reduce(preflop, call(preflop.toAct)) // should advance to FLOP automatically
    if (s.tag !== 'FLOP' && s.tag !== 'SHOWDOWN')
      throw new Error('expected FLOP or SHOWDOWN')

    if (s.tag === 'FLOP') {
      // check around to move to TURN
      let flop = expectState(s, 'FLOP')
      s = reduce(flop, call(flop.toAct)) // treat as check via call when toCall=0 (your UI would gate this)
      if (s.tag === 'FLOP') {
        flop = expectState(s, 'FLOP')
        s = reduce(flop, call(flop.toAct))
      }
      if (s.tag === 'FLOP') {
        flop = expectState(s, 'FLOP')
        s = reduce(flop, call(flop.toAct))
      }
      if (s.tag !== 'TURN' && s.tag !== 'SHOWDOWN')
        throw new Error('expected TURN or SHOWDOWN')
    }

    // On TURN, shove + calls
    if (s.tag === 'TURN') {
      const turn = expectState(s, 'TURN')
      const shover = turn.toAct
      const shoveTo = allInAmount(
        turn.players[shover].stack,
        turn.players[shover].bet
      )
      s = reduce(turn, raiseTo(shover, shoveTo)) // shover all-in
      if (s.tag === 'TURN') {
        const afterShove = expectState(s, 'TURN')
        s = reduce(afterShove, call(afterShove.toAct)) // player 2 calls
      }
      if (s.tag === 'TURN') {
        const afterCall = expectState(s, 'TURN')
        s = reduce(afterCall, call(afterCall.toAct)) // player 3 calls or folds; if folds, still all-in/live players >=2?
      }
    }

    expect(s.tag).toBe('COMPLETE')
  })
})
