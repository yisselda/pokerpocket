import type { Action, GameState, BettingPhase } from './types.js'
import { shuffleDeck } from './deck.js'
import { dealCommunity, dealHole } from './deal.js'
import { firstToActPostflop, firstToActPreflop } from './positions.js'
import { settleStreetBets } from './pots.js'
import {
  nextActorIndex,
  noFurtherActionsPossible,
  onlyOneNonFolded,
  shouldCloseBetting,
} from './rounds.js'
import { resolveShowdown } from './showdown.js'

const bettingPhases: BettingPhase[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER']

function nextBettingPhase(cur: BettingPhase): BettingPhase | 'SHOWDOWN' {
  const i = bettingPhases.indexOf(cur)
  return bettingPhases[i + 1] ?? 'SHOWDOWN'
}

export function reduce(state: GameState, action: Action): GameState {
  switch (state.tag) {
    case 'INIT':
      if (action.type === 'START') {
        const deck = shuffleDeck(state.rng)
        return {
          tag: 'DEAL',
          players: state.players,
          deck,
          bigBlind: state.bigBlind,
          dealer: state.dealer,
          rng: state.rng,
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
          rng: state.rng,
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
        let roundStart = state.roundStart

        // super-minimal demo semantics:
        if (action.move === 'FOLD') {
          me.folded = true
          if (roundStart === action.seat) {
            roundStart = nextActorIndex(players, action.seat)
          }
          if (lastAggressor === action.seat) {
            lastAggressor = undefined
          }
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
            rng: state.rng,
          }
        }

        // All-in fast-forward
        if (noFurtherActionsPossible(players)) {
          // 1) settle this street
          const settled = settleStreetBets(players, state.pots)
          const { players: ffPlayers, pots: ffPots } = settled
          let ffBoard = [...state.board]
          let ffDeck = [...state.deck]
          let phase: BettingPhase = state.tag

          // 2) deal out remaining streets
          while (true) {
            const next = nextBettingPhase(phase)
            if (next === 'SHOWDOWN') break
            const dealt = dealCommunity(ffBoard, ffDeck, phase)
            ffBoard = dealt.board
            ffDeck = dealt.deck
            phase = next
          }

          // 3) showdown now
          const payouts = resolveShowdown(ffPlayers, ffBoard, ffPots)
          return {
            tag: 'COMPLETE',
            winners: payouts,
            players: ffPlayers,
            bigBlind: state.bigBlind ?? 100,
            dealer: state.dealer,
            rng: state.rng,
          }
        }

        // Advance turn
        const toAct = nextActorIndex(players, state.toAct)

        const provisional = {
          ...state,
          players,
          toAct,
          targetBet,
          lastAggressor,
          roundStart,
        }

        if (shouldCloseBetting(provisional, state.toAct)) {
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
              rng: state.rng,
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
            rng: state.rng,
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
            rng: state.rng,
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
          rng: state.rng,
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
          rng: state.rng,
        }
      }
      return state

    case 'COMPLETE':
      if (action.type === 'NEXT_HAND') {
        return {
          tag: 'DEAL',
          players: state.players,
          deck: shuffleDeck(state.rng),
          bigBlind: state.bigBlind ?? 100,
          dealer: (state.dealer + 1) % state.players.length,
          rng: state.rng,
        }
      }
      return state
  }
}
