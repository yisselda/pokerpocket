import type { Action, GameState, BettingPhase } from './types'
import { shuffleDeck } from './deck'
import { dealCommunity, dealHole } from './deal'

const bettingPhases: BettingPhase[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER']

function nextBettingPhase(cur: BettingPhase): BettingPhase | 'SHOWDOWN' {
  const i = bettingPhases.indexOf(cur)
  return bettingPhases[i + 1] ?? 'SHOWDOWN'
}

function advanceToNextActor(playersLen: number, current: number): number {
  return (current + 1) % playersLen
}

export function reduce(state: GameState, action: Action): GameState {
  switch (state.tag) {
    case 'INIT':
      if (action.type === 'START') {
        const deck = shuffleDeck()
        return {
          tag: 'DEAL',
          players: state.players,
          deck,
          bigBlind: state.bigBlind,
        }
      }
      return state

    case 'DEAL':
      if (action.type === 'DEAL_CARDS') {
        const dealt = dealHole(state.players, state.deck)
        return {
          tag: 'PREFLOP',
          players: dealt.players,
          board: [],
          pots: [],
          toAct: 0,
          bigBlind: state.bigBlind,
          deck: dealt.deck,
        }
      }
      return state

    case 'PREFLOP':
    case 'FLOP':
    case 'TURN':
    case 'RIVER':
      if (action.type === 'PLAYER_ACTION') {
        if (action.seat !== state.toAct) return state // not your turn, ignore in engine v1

        const players = state.players.map(p => ({ ...p }))
        const me = players[action.seat]

        // super-minimal demo semantics:
        if (action.move === 'FOLD') {
          me.folded = true
        } else if (action.move === 'CALL') {
          const maxBet = Math.max(...players.map(p => p.bet))
          const toCall = Math.max(0, maxBet - me.bet)
          const pay = Math.min(toCall, me.stack)
          me.stack -= pay
          me.bet += pay
          me.contributed += pay
          if (me.stack === 0) me.allIn = true
        } else if (action.move === 'CHECK') {
          // allowed only if no one beat you; selector guards UI
        } else if (
          action.move === 'RAISE' &&
          typeof action.amount === 'number'
        ) {
          const maxBet = Math.max(...players.map(p => p.bet))
          const toCall = Math.max(0, maxBet - me.bet)
          const raiseMore = Math.max(0, action.amount - (me.bet + toCall))
          const pay = Math.min(me.stack, toCall + raiseMore)
          me.stack -= pay
          me.bet += pay
          me.contributed += pay
          if (me.stack === 0) me.allIn = true
        }

        const toAct = advanceToNextActor(players.length, state.toAct)
        return { ...state, players, toAct }
      }

      if (action.type === 'ROUND_COMPLETE') {
        const next = nextBettingPhase(state.tag)
        if (next === 'SHOWDOWN') {
          return {
            tag: 'SHOWDOWN',
            players: state.players,
            board: state.board,
            pots: state.pots,
            bigBlind: state.bigBlind ?? 100,
          }
        }

        const { board, deck } = dealCommunity(
          state.board,
          state.deck,
          state.tag
        )
        return { ...state, tag: next, board, deck }
      }

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
