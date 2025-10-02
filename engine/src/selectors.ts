import type { Card, GameState, LegalActions } from './types.js'
import { parseCards } from './cards.js'
import { formatBoard } from './format.js'
import { assignPositions } from './positions.js'
import { reduce } from './reducer.js'
import { dealCards, startHand, toShowdown } from './actions.js'

export function getPhase(state: GameState) {
  return state.tag
}

export function getPlayers(state: GameState) {
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

export function getBoardAscii(state: GameState): string {
  const board = getBoardCards(state)
  return board.length ? formatBoard(board) : ''
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

export function getActingSeat(state: GameState): number | null {
  return typeof (state as { toAct?: number }).toAct === 'number'
    ? (state as { toAct: number }).toAct
    : null
}

const BETTING_PHASES = new Set(['PREFLOP', 'FLOP', 'TURN', 'RIVER'])

export function isBettingPhase(state: GameState): state is Extract<
  GameState,
  { tag: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' }
> {
  return BETTING_PHASES.has(state.tag)
}

export function currentActorSeat(state: GameState): number | null {
  if (!isBettingPhase(state)) return null
  return typeof state.toAct === 'number' ? state.toAct : null
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

export function isBettingDecision(state: GameState): boolean {
  const seat = currentActorSeat(state)
  if (seat === null) return false
  const legal = getLegalActions(state, seat)
  return (
    legal.canFold ||
    legal.canCheck ||
    legal.canCall ||
    legal.minRaise !== undefined
  )
}

export function isComplete(state: GameState): boolean {
  return state.tag === 'COMPLETE'
}

export function isHandDone(state: GameState): boolean {
  return isComplete(state)
}

function nextAutoAction(state: GameState) {
  switch (state.tag) {
    case 'INIT':
      return startHand()
    case 'DEAL':
      return dealCards()
    case 'SHOWDOWN':
      return toShowdown()
    default:
      return null
  }
}

export function advanceUntilDecision(state: GameState): GameState {
  let current = state
  while (true) {
    if (isBettingDecision(current) || isComplete(current)) {
      return current
    }
    const action = nextAutoAction(current)
    if (!action) {
      return current
    }
    const next = reduce(current, action)
    if (next === current) {
      return current
    }
    current = next
  }
}

export type PositionLabel = 'BTN' | 'SB' | 'BB' | ''

export function getPositions(state: GameState): PositionLabel[] {
  const players = getPlayers(state)
  const n = players.length
  if (n === 0) return []
  const dealer =
    typeof (state as { dealer?: number }).dealer === 'number'
      ? ((state as { dealer: number }).dealer % n + n) % n
      : 0
  const assigned = assignPositions(n, dealer)
  return assigned.map(pos => (pos === 'BTN' || pos === 'SB' || pos === 'BB' ? pos : ''))
}

export interface ActionOptions {
  seat: number
  canFold: boolean
  canCheck: boolean
  canCall: boolean
  toCall: number
  raise?: {
    min: number
    max?: number
    unopened: boolean
  }
}

export function getActionOptions(state: GameState): ActionOptions | null {
  const seat = currentActorSeat(state)
  if (seat === null) return null
  const legal = getLegalActions(state, seat)
  const toCall = getToCall(state, seat)

  const options: ActionOptions = {
    seat,
    canFold: legal.canFold,
    canCheck: legal.canCheck,
    canCall: legal.canCall,
    toCall,
  }

  if (legal.minRaise !== undefined) {
    options.raise = {
      min: legal.minRaise,
      max: legal.maxRaise,
      unopened: toCall === 0,
    }
  }

  return options
}
