import { describe, it, expect } from 'vitest'

import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { dealCards, endRound, startHand } from '../src/actions'
import {
  getBoardCards,
  getBoardAscii,
  getPhase,
  getPlayers,
} from '../src/selectors'

describe('selectors', () => {
  it('returns community cards as structured objects and ascii', () => {
    let state = createTable(3, 1000, 100)
    state = reduce(state, startHand())
    state = reduce(state, dealCards())
    state = reduce(state, endRound())

    expect(getPhase(state)).toBe('FLOP')

    const structured = getBoardCards(state)
    expect(structured.length).toBe(3)
    structured.forEach(card => {
      expect(card).toHaveProperty('rank')
      expect(card).toHaveProperty('suit')
    })

    const boardAscii = getBoardAscii(state)
    expect(boardAscii).toMatch(/\s/) // cards separated by space
    expect(boardAscii.length).toBeGreaterThan(0)

    const players = getPlayers(state)
    expect(players.length).toBe(3)
  })
})
