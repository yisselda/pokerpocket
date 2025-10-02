import { describe, it, expect } from 'vitest'

import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { dealCards, endRound, startHand } from '../src/actions'
import { getBoard, getBoardCards } from '../src/selectors'

describe('selectors', () => {
  it('returns community cards as structured objects', () => {
    let state = createTable(3, 1000, 100)
    state = reduce(state, startHand())
    state = reduce(state, dealCards())
    state = reduce(state, endRound())

    const rawBoard = getBoard(state)
    const structured = getBoardCards(state)

    expect(structured.length).toBe(rawBoard.length)
    structured.forEach(card => {
      expect(card).toHaveProperty('rank')
      expect(card).toHaveProperty('suit')
      expect(typeof card.rank).toBe('string')
      expect(typeof card.suit).toBe('string')
    })
  })
})
