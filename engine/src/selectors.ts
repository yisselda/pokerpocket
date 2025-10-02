import type { Card, GameState, LegalActions } from './types.js'
import { parseCards } from './cards.js'

export function getPhase(state: GameState) {
  return state.tag
}

export function getPlayers(state: GameState) {
  // All states except COMPLETE have players (COMPLETE has winners + players)
  return 'players' in state ? state.players : []
}

export function getBoard(state: GameState) {
  return 'board' in state && Array.isArray(state.board) ? state.board : []
}

export function getBoardCards(state: GameState): Card[] {
  const board = getBoard(state)
  if (board.length === 0) return []
  return parseCards(board)
}

export function getPots(state: GameState) {
  return 'pots' in state && Array.isArray(state.pots) ? state.pots : []
}

export function getPotSize(state: GameState): number {
  const pots = getPots(state)
  return pots.reduce((sum, p) => sum + p.amount, 0)
}

export function getCurrentPlayer(state: GameState) {
  if (
    state.tag === 'PREFLOP' ||
    state.tag === 'FLOP' ||
    state.tag === 'TURN' ||
    state.tag === 'RIVER'
  ) {
    return state.players[state.toAct] ?? null
  }
  return null
}

export function getToCall(state: GameState, seat: number): number {
  if (
    !(
      state.tag === 'PREFLOP' ||
      state.tag === 'FLOP' ||
      state.tag === 'TURN' ||
      state.tag === 'RIVER'
    )
  )
    return 0
  const maxBet = Math.max(...state.players.map(p => p.bet))
  const me = state.players[seat]
  return Math.max(0, maxBet - me.bet)
}

export function getLegalActions(state: GameState, seat: number): LegalActions {
  const noActions: LegalActions = {
    canFold: false,
    canCheck: false,
    canCall: false,
    callAmount: 0,
  }
  if (
    !(
      state.tag === 'PREFLOP' ||
      state.tag === 'FLOP' ||
      state.tag === 'TURN' ||
      state.tag === 'RIVER'
    )
  ) {
    return noActions
  }
  const me = state.players[seat]
  if (!me || me.folded || me.allIn) return noActions

  const bets = state.players.map(p => p.bet).sort((a, b) => a - b)
  const maxBet = bets[bets.length - 1]
  const second = bets[bets.length - 2] ?? 0
  const lastRaise = Math.max(state.bigBlind, maxBet - second)
  const toCall = Math.max(0, maxBet - me.bet)

  const canCheck = toCall === 0
  const canCall = toCall > 0 && me.stack >= toCall
  const callAmount = canCall ? toCall : 0

  let minRaise: number | undefined
  if (toCall === 0) {
    // opening bet must be at least big blind
    minRaise = Math.min(me.stack, me.bet + state.bigBlind)
  } else {
    // raise must be at least last raise size
    minRaise = Math.min(me.stack + me.bet, maxBet + lastRaise)
  }

  const maxRaise = me.stack + me.bet // all-in cap

  return { canFold: true, canCheck, canCall, callAmount, minRaise, maxRaise }
}
