import { Card } from '../../types.js'
import { RNG } from '../../rng.js'

// Public types exactly as specified
export type Variant = 'NLHE'
export type Street =
  | 'PREFLOP'
  | 'FLOP'
  | 'TURN'
  | 'RIVER'
  | 'SHOWDOWN'
  | 'COMPLETE'

export interface TableConfig {
  variant: Variant
  maxSeats: number
  blinds: { sb: number; bb: number }
  ante?: number
  oddChipRule?: 'LEFT_OF_BUTTON' | 'HIGHEST_CARD'
  seed?: number | string
  rng?: Rng
}

export interface Rng {
  draw(count: number): Card[]
}

export interface Seat {
  id: string
  name?: string
  stack: number
  folded: boolean
  allIn: boolean
  hole?: [Card, Card]
  contributed: number
  streetContributed: number
}

export interface Pot {
  amount: number
  eligible: string[]
}

export interface ActionEvent {
  at: number
  seat?: number
  kind:
    | 'SIT'
    | 'LEAVE'
    | 'START_HAND'
    | 'CHECK'
    | 'CALL'
    | 'BET'
    | 'RAISE'
    | 'ALL_IN'
    | 'FOLD'
    | 'ADVANCE_STREET'
    | 'SHOWDOWN'
    | 'AWARD'
  data?: Record<string, unknown>
}

export interface TableState {
  handId: number
  config: TableConfig
  button: number
  sbIndex: number
  bbIndex: number
  actionOn: number
  lastAggressor?: number
  street: Street
  board: Card[]
  seats: Seat[]
  pots: Pot[]
  currentBet: number
  lastRaiseSize: number
  bettingReopened: boolean // Track if action can be reopened
  hasActedThisRound: Set<number> // Track who has acted this betting round
  winners?: { seatId: string; amount: number }[]
  history: ActionEvent[]
}

export type Action =
  | { type: 'SIT'; seat: number; buyin: number; name?: string }
  | { type: 'LEAVE'; seat: number }
  | { type: 'START_HAND' }
  | { type: 'CHECK'; seat: number }
  | { type: 'CALL'; seat: number }
  | { type: 'BET'; seat: number; to: number }
  | { type: 'RAISE'; seat: number; to: number }
  | { type: 'ALL_IN'; seat: number; to?: number }
  | { type: 'FOLD'; seat: number }
  | { type: 'MUCK'; seat: number }
  | { type: 'REVEAL'; seat: number }

export interface LegalActions {
  canFold: boolean
  canCheck: boolean
  canCall: boolean
  callAmount: number
  canBet: boolean
  minBet: number
  canRaise: boolean
  minRaiseTo: number
  maxRaiseTo: number
}
