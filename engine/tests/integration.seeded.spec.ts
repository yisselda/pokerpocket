import { describe, it, expect } from 'vitest'
import {
  createTable,
  reduce,
  startHand,
  dealCards,
  endRound,
  serializeRng,
  getBoard,
} from '../src/index'
import { expectState } from '../src/testing'

type Snapshot = {
  board: string[]
  snapshot: number
}

function playSeededHand(seed = 42): Snapshot {
  let state = createTable(4, 1000, 100, { seed })
  state = reduce(state, startHand())
  const deal = expectState(state, 'DEAL')
  state = reduce(deal, dealCards())

  const preflop = expectState(state, 'PREFLOP')
  preflop.players.forEach(p => {
    p.bet = 200
    p.stack -= 200
  })

  state = reduce(preflop, endRound())
  state = reduce(state, endRound())
  state = reduce(state, endRound())
  state = reduce(state, endRound())

  const showdown = expectState(state, 'SHOWDOWN')
  const board = getBoard(showdown)
  const snapshot = serializeRng(showdown)
  if (snapshot === undefined) throw new Error('rng missing')

  return { board, snapshot }
}

describe('seeded integration', () => {
  it('replays the same board and RNG snapshot for seed 42', () => {
    const first = playSeededHand(42)
    const second = playSeededHand(42)

    const EXPECTED_BOARD = ['Qd', 'Tc', 'Kh', 'Th', '2c']
    const EXPECTED_SNAPSHOT = 926721163

    expect(first.board).toEqual(EXPECTED_BOARD)
    expect(second.board).toEqual(EXPECTED_BOARD)
    expect(second.snapshot).toBe(first.snapshot)
    expect(second.snapshot).toBe(EXPECTED_SNAPSHOT)
  })
})
