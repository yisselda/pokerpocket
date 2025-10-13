import { bench, describe } from 'vitest'

import {
  createTable,
  reduce,
  startHand,
  dealCards,
  toShowdown,
  check,
  call,
  raiseTo,
  fold,
  getCurrentPlayer,
  getLegalActions,
} from '../src/index'
import type { GameState } from '../src/types'
import { LcgRng } from '../src/rng'
import { shuffleDeck } from '../src/deck'
import { evaluateSevenCards } from '../src/evaluator'

const SAMPLE_HAND = ['As', 'Ks', 'Qs', 'Js', 'Ts', '9h', '9d']

function autoAdvance(state: GameState): GameState {
  let current = state

  for (;;) {
    if (current.tag === 'INIT') {
      current = reduce(current, startHand())
      continue
    }
    if (current.tag === 'DEAL') {
      current = reduce(current, dealCards())
      continue
    }
    if (current.tag === 'SHOWDOWN') {
      current = reduce(current, toShowdown())
      continue
    }
    return current
  }
}

function playDeterministicHand(seed: number): GameState {
  let state = autoAdvance(createTable(6, 20000, 100, { seed }))

  while (state.tag !== 'COMPLETE') {
    const actor = getCurrentPlayer(state)
    if (!actor) break

    const seat = actor.id ?? ('toAct' in state ? state.toAct : undefined)
    if (typeof seat !== 'number') break

    const legal = getLegalActions(state, seat)
    const action = legal.canCheck
      ? check(seat)
      : legal.canCall
        ? call(seat)
        : typeof legal.minRaise === 'number'
          ? raiseTo(seat, legal.minRaise)
          : fold(seat)

    state = reduce(state, action)
    state = autoAdvance(state)
  }

  if (state.tag !== 'COMPLETE') {
    throw new Error('Hand did not reach completion')
  }

  return state
}

describe('engine performance', () => {
  bench('shuffleDeck with LCG', () => {
    const rng = new LcgRng(42)
    shuffleDeck(rng)
  })

  bench('evaluateSevenCards canonical hand', () => {
    evaluateSevenCards(SAMPLE_HAND)
  })

  bench('play deterministic hand (6 players)', () => {
    playDeterministicHand(1337)
  })
})
