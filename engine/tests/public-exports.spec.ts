import { describe, it, expect } from 'vitest'

import { LcgRng } from '../src/rng'
import { createTable } from '../src/init'

import {
  fromString,
  toAscii,
  createDeck,
  shuffle,
} from '../src/cards.public'
import {
  evaluate5,
  evaluate7,
  compareHands,
} from '../src/eval.public'
import {
  formatBoard,
  formatChips,
  formatAction,
} from '../src/format.public'
import {
  expectState,
  fastForward,
  withDeck,
  applyActions,
  snapshot,
} from '../src/testing.public'

describe('public utility exports', () => {
  it('provides card helpers', () => {
    const aceSpades = fromString('As')
    expect(toAscii(aceSpades)).toBe('A♠')

    const deck = createDeck()
    expect(deck).toHaveLength(52)
    const rng = new LcgRng(1)
    const shuffled = shuffle(deck, rng)
    expect(shuffled).not.toEqual(deck)
  })

  it('evaluates hands and compares results', () => {
    const fiveCard = evaluate5(['As', 'Ks', 'Qs', 'Js', 'Ts'])
    const sevenCard = evaluate7(['As', 'Ks', 'Qs', 'Js', 'Ts', '9h', '9d'])
    expect(fiveCard.category).toBe('STRAIGHT_FLUSH')
    expect(sevenCard.category).toBe('STRAIGHT_FLUSH')

    const compare = compareHands(fiveCard, sevenCard)
    expect(compare).toBe(0)
  })

  it('formats board, chips, and actions', () => {
    const board = formatBoard(['As', 'Kd', 'Tc'])
    expect(board).toBe('A♠ K♦ T♣')
    expect(formatChips(12345)).toBe('12,345')

    const actionString = formatAction(
      { type: 'PLAYER_ACTION', seat: 0, move: 'RAISE', amount: 200 },
      { prefixSeat: true }
    )
    expect(actionString).toBe('P1 raise to 200')
  })

  it('exposes testing helpers', () => {
    let state = createTable(2, 1000, 100)
    state = fastForward(state, { maxIterations: 1 })
    const deal = expectState(state, 'DEAL')

    const customDeck = ['As', 'Kd', 'Qc', 'Jh', 'Ts', '9c', '8d']
    const withCustomDeck = withDeck(deal, customDeck)
    expect(withCustomDeck.deck?.slice(-7)).toEqual(customDeck)

    const dealt = applyActions(withCustomDeck, [{ type: 'DEAL_CARDS' }])
    const preflop = expectState(dealt, 'PREFLOP')
    expect(preflop.players.length).toBe(2)

    const snap = snapshot(preflop)
    expect(snap.players).toHaveLength(2)
    expect(snap.tag).toBe('PREFLOP')
  })
})
