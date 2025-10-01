import type { Action, GameState, BettingPhase } from './types'
import { shuffleDeck } from './deck'

const bettingPhases: BettingPhase[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER']

function nextBettingPhase(cur: BettingPhase): BettingPhase | 'SHOWDOWN' {
  const i = bettingPhases.indexOf(cur)
  return bettingPhases[i + 1] ?? 'SHOWDOWN'
}

export function reduce(state: GameState, action: Action): GameState {
  switch (state.tag) {
    case 'INIT':
      if (action.type === 'START') {
        return {
          tag: 'DEAL',
          players: state.players,
          deck: shuffleDeck(),
          bigBlind: state.bigBlind,
        }
      }
      return state

    case 'DEAL':
      if (action.type === 'DEAL_CARDS') {
        // (deal hole cards later—stub for now)
        return {
          tag: 'PREFLOP',
          players: state.players,
          board: [],
          pots: [],
          toAct: 0,
          bigBlind: state.bigBlind,
        }
      }
      return state

    case 'PREFLOP':
    case 'FLOP':
    case 'TURN':
    case 'RIVER':
      if (action.type === 'ROUND_COMPLETE') {
        const next = nextBettingPhase(state.tag)
        if (next === 'SHOWDOWN') {
          return {
            tag: 'SHOWDOWN',
            players: state.players,
            board: state.board,
            pots: state.pots,
            bigBlind: state.bigBlind,
          }
        }
        // (deal community cards later—stub for now)
        return { ...state, tag: next }
      }
      // player actions handled later; return unchanged for now
      return state

    case 'SHOWDOWN':
      if (action.type === 'SHOWDOWN') {
        // (evaluate hands later—stub)
        return {
          tag: 'COMPLETE',
          winners: [],
          players: state.players,
          bigBlind: state.bigBlind ?? 100,
        }
      }
      return state

    case 'COMPLETE':
      if (action.type === 'NEXT_HAND') {
        return {
          tag: 'DEAL',
          players: state.players,
          deck: shuffleDeck(),
          bigBlind: state.bigBlind ?? 100,
        }
      }
      return state
  }
}
