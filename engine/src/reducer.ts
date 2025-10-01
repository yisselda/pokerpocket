import type { Action, GameState, BettingPhase } from './types'
import { shuffleDeck } from './deck'
import { dealCommunity, dealHole } from './deal'
import { stat } from 'fs'
import { firstToActPreflop } from './positions'
import { settleStreetBets } from './pots'
import { on } from 'events'
import { nextActorIndex, onlyOneNonFolded } from './rounds'
import { resolve } from 'path'
import { resolveShowdown } from './showdown'

const bettingPhases: BettingPhase[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER']

function nextBettingPhase(cur: BettingPhase): BettingPhase | 'SHOWDOWN' {
  const i = bettingPhases.indexOf(cur)
  return bettingPhases[i + 1] ?? 'SHOWDOWN'
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
          dealer: state.dealer,
        }
      }
      return state

    case 'DEAL':
      if (action.type === 'DEAL_CARDS') {
        const dealt = dealHole(state.players, state.deck)

        const players = dealt.players.map(p => ({ ...p }))
        const n = players.length
        const dealer = state.dealer

        if (n === 2) {
          // heads-up: SB is dealer, BB is other
          const sb = dealer
          const bb = (dealer + 1) % n
          players[sb].stack -= state.bigBlind / 2
          players[sb].bet = state.bigBlind / 2
          players[bb].stack -= state.bigBlind
          players[bb].bet = state.bigBlind
          players[sb].contributed = state.bigBlind / 2
          players[bb].contributed = state.bigBlind
        } else {
          // normal: dealer, SB, BB
          const sb = (dealer + 1) % n
          const bb = (dealer + 2) % n
          players[sb].stack -= state.bigBlind / 2
          players[sb].bet = state.bigBlind / 2
          players[bb].stack -= state.bigBlind
          players[bb].bet = state.bigBlind
          players[sb].contributed = state.bigBlind / 2
          players[bb].contributed = state.bigBlind
        }

        const toAct = firstToActPreflop(n, dealer)

        return {
          tag: 'PREFLOP',
          players: players,
          board: [],
          pots: [],
          toAct: toAct,
          bigBlind: state.bigBlind,
          deck: dealt.deck,
          dealer: dealer,
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

        if (onlyOneNonFolded(players)) {
          const alivePlayer = players.find(p => !p.folded)
          // TODO: settleStreetBets -> then convert all pots to single payout for `alive`
          // For now just jump to COMPLETE stub:
          return {
            tag: 'COMPLETE',
            winners: [{ seatId: alivePlayer?.id ?? 0, amount: 0 }],
            players: state.players,
            bigBlind: state.bigBlind ?? 100,
            dealer: state.dealer,
          }
        }

        const toAct = nextActorIndex(players, state.toAct)
        return { ...state, players, toAct }
      }

      if (action.type === 'ROUND_COMPLETE') {
        const settled = settleStreetBets(state.players, state.pots)
        const players = settled.players
        const pots = settled.pots

        const next = nextBettingPhase(state.tag)
        if (next === 'SHOWDOWN') {
          return {
            tag: 'SHOWDOWN',
            players,
            board: state.board,
            pots,
            bigBlind: state.bigBlind ?? 100,
            dealer: state.dealer,
          }
        }

        const { board, deck } = dealCommunity(
          state.board,
          state.deck,
          state.tag
        )
        return { ...state, tag: next, players, pots, board, deck, toAct: 0 }
      }

      return state

    case 'SHOWDOWN':
      if (action.type === 'SHOWDOWN') {
        const payouts = resolveShowdown(state.players, state.board, state.pots)

        return {
          tag: 'COMPLETE',
          winners: payouts,
          players: state.players,
          bigBlind: state.bigBlind ?? 100,
          dealer: state.dealer,
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
          dealer: (state.dealer + 1) % state.players.length,
        }
      }
      return state
  }
}
