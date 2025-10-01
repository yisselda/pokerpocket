export type SeatId = number // Position at the table (0..nbPlayers-1)

export interface Player {
  id: SeatId
  name: string
  stack: number
  bet: number // chips on this street
  contributed: number // chips across the whole hand
  folded: boolean
  allIn: boolean
  hole?: [string, string] // 'As','Kd' etc.
}

export interface Pot {
  amount: number
  eligible: SeatId[] // seatIds eligible for this pot
}

export type Phase =
  | 'INIT' // INIT = table is ready, hand not started yet
  | 'DEAL'
  | 'PREFLOP'
  | 'FLOP'
  | 'TURN'
  | 'RIVER'
  | 'SHOWDOWN'
  | 'COMPLETE' // COMPLETE = last hand finished, waiting for NEXT_HAND

export type BettingPhase = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER'

// GameState is a tagged union: each phase (INIT, DEAL, PREFLOP, etc.)
// is a distinct variant with only the data valid in that phase.
// This prevents invalid states (e.g. board cards in INIT) and makes
// the reducer + selectors type-safe and easy to test.
export type GameState =
  | { tag: 'INIT'; players: Player[]; bigBlind: number }
  | { tag: 'DEAL'; players: Player[]; deck: string[]; bigBlind: number }
  | {
      tag: BettingPhase
      players: Player[]
      board: string[]
      pots: Pot[]
      toAct: SeatId
      bigBlind: number
      deck: string[]
    }
  | {
      tag: 'SHOWDOWN'
      players: Player[]
      board: string[]
      pots: Pot[]
      bigBlind: number
    }
  | {
      tag: 'COMPLETE'
      winners: { seatId: SeatId; amount: number }[]
      players: Player[]
      bigBlind: number
    }

export type Action =
  | { type: 'START' }
  | { type: 'DEAL_CARDS' }
  | {
      type: 'PLAYER_ACTION'
      seat: SeatId
      move: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE'
      amount?: number
    }
  | { type: 'ROUND_COMPLETE' }
  | { type: 'SHOWDOWN' }
  | { type: 'NEXT_HAND' }

export interface LegalActions {
  canFold: boolean
  canCheck: boolean
  canCall: boolean
  minRaise?: number
  maxRaise?: number
}
