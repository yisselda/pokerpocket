import { describe, it, expect } from 'vitest'

import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { dealCards, endRound, fold, startHand } from '../src/actions'
import {
  advanceUntilDecision,
  currentActorSeat,
  getActionOptions,
  getBoardAscii,
  getBoardCards,
  getPhase,
  getPlayers,
  getPositions,
  isBettingDecision,
  isHandDone,
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
    expect(boardAscii).toMatch(/\s/)
    expect(boardAscii.length).toBeGreaterThan(0)

    const players = getPlayers(state)
    expect(players.length).toBe(3)
  })

  it('advances automatically to the next decision', () => {
    let state = createTable(2, 1000, 100)
    state = advanceUntilDecision(state)

    expect(state.tag).toBe('PREFLOP')
    expect(isBettingDecision(state)).toBe(true)
    expect(currentActorSeat(state)).toBe(0)

    const options = getActionOptions(state)
    expect(options).not.toBeNull()
    expect(options).toMatchObject({
      seat: 0,
      canFold: true,
      canCall: true,
      toCall: 50,
    })
    expect(options?.raise).toMatchObject({ min: 200, max: 1000, unopened: false })

    const positions = getPositions(state)
    expect(positions).toEqual(['BTN', 'BB'])

    const action = fold(options!.seat)
    state = reduce(state, action)
    state = advanceUntilDecision(state)

    expect(isHandDone(state)).toBe(true)
    const winners = 'winners' in state ? state.winners : []
    expect(winners).toHaveLength(1)
    expect(winners[0]?.seatId).toBe(1)
  })

  it('provides BTN/SB/BB markers for multi-handed tables', () => {
    let state = createTable(5, 1000, 100)
    state = advanceUntilDecision(state)

    const positions = getPositions(state)
    expect(positions.slice(0, 3)).toEqual(['BTN', 'SB', 'BB'])
    expect(positions.slice(3)).toEqual(['', ''])
  })
})
