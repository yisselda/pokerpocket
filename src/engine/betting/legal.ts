import { TableState, LegalActions } from './types.js'

/**
 * Computes legal actions for a seat at the current table state
 */
export function getLegalActions(state: TableState, seatIndex: number): LegalActions {
  // TODO: Implement legal actions computation
  return {
    canFold: false,
    canCheck: false,
    canCall: false,
    callAmount: 0,
    canBet: false,
    minBet: 0,
    canRaise: false,
    minRaiseTo: 0,
    maxRaiseTo: 0,
  }
}