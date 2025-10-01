import type { Action, GameState, BettingPhase } from './types'
import { shuffleDeck } from './deck'
import { dealCommunity, dealHole } from './deal'
import { stat } from 'fs'
import { firstToActPostflop, firstToActPreflop } from './positions'
import { settleStreetBets } from './pots'
import { on } from 'events'
import { nextActorIndex, onlyOneNonFolded, shouldCloseBetting } from './rounds'
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
        const targetBet = Math.max(...players.map(p => p.bet))

        return {
          tag: 'PREFLOP',
          players: players,
          board: [],
          pots: [],
          toAct,
          bigBlind: state.bigBlind,
          deck: dealt.deck,
          dealer: dealer,
          roundStart: toAct,
          lastAggressor: undefined,
          targetBet,
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

        let lastAggressor = state.lastAggressor
        let targetBet = state.targetBet

        // super-minimal demo semantics:
        if (action.move === 'FOLD') {
          me.folded = true
        } else if (action.move === 'CHECK') {
          // no chips move
        } else if (action.move === 'CALL') {
          const toCall = Math.max(0, targetBet - me.bet)
          const pay = Math.min(toCall, me.stack)
          me.stack -= pay
          me.bet += pay
          me.contributed += pay
          if (me.stack === 0) me.allIn = true
        } else if (
          action.move === 'RAISE' &&
          typeof action.amount === 'number'
        ) {
          const toCall = Math.max(0, targetBet - me.bet)
          // action.amount is a "raise to" amount (final bet), not "raise by".
          const raiseTo = Math.max(action.amount, targetBet)
          const need = Math.max(0, raiseTo - me.bet)
          const pay = Math.min(me.stack, need)
          me.stack -= pay
          me.bet += pay
          me.contributed += pay
          if (me.stack === 0) me.allIn = true

          targetBet = Math.max(targetBet, me.bet)
          lastAggressor = action.seat
        }

        if (onlyOneNonFolded(players)) {
          const { players: settledPlayers, pots } = settleStreetBets(
            players,
            state.pots
          )
          //error if no winner found
          const winner = settledPlayers.find(p => !p.folded)
          return {
            tag: 'COMPLETE',
            winners: [
              {
                seatId: winner?.id ?? 0,
                amount: pots.reduce((a, b) => a + b.amount, 0),
              },
            ],
            players: settledPlayers,
            bigBlind: state.bigBlind ?? 100,
            dealer: state.dealer,
          }
        }

        // Advance turn
        const toAct = nextActorIndex(players, state.toAct)

        let provisional = {
          ...state,
          players,
          toAct,
          targetBet,
          lastAggressor,
        }

        if (shouldCloseBetting(provisional)) {
          // 1) settle street
          const settled = settleStreetBets(
            provisional.players,
            provisional.pots
          )
          const players2 = settled.players
          const pots2 = settled.pots

          // 2) next street (or showdown)
          const next = nextBettingPhase(state.tag)
          if (next === 'SHOWDOWN') {
            return {
              tag: 'SHOWDOWN',
              players: players2,
              board: state.board,
              pots: pots2,
              bigBlind: state.bigBlind ?? 100,
              dealer: state.dealer,
            }
          }

          // deal next community card(s)
          const dealt = dealCommunity(state.board, state.deck, state.tag)
          const toActNext = firstToActPostflop(players2, state.dealer)
          return {
            tag: next,
            players: players2,
            pots: pots2,
            board: dealt.board,
            toAct: toActNext,
            bigBlind: state.bigBlind,
            dealer: state.dealer,
            roundStart: toActNext,
            deck: dealt.deck,
            lastAggressor: undefined,
            targetBet: 0,
          }
        }

        return provisional
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
        const toActNext = firstToActPostflop(players, state.dealer)
        return {
          ...state,
          tag: next,
          players,
          pots,
          board,
          deck,
          toAct: toActNext,
          targetBet: 0,
          roundStart: toActNext,
          lastAggressor: undefined,
        }
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
