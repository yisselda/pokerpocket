import { TableState, LegalActions } from './types.js'

/**
 * Computes legal actions for a seat at the current table state
 */
export function getLegalActions(state: TableState, seatIndex: number): LegalActions {
  const result: LegalActions = {
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

  // Validate seat index
  if (seatIndex < 0 || seatIndex >= state.config.maxSeats) {
    return result
  }

  const seat = state.seats[seatIndex]

  // No actions if seat is empty, folded, or all-in
  if (seat.id === '' || seat.folded || seat.allIn) {
    return result
  }

  // Not your turn - but still allow checking legal actions for UI
  // if (state.actionOn !== seatIndex) {
  //   return result
  // }

  // Game is complete
  if (state.street === 'COMPLETE') {
    return result
  }

  const toCall = Math.max(0, state.currentBet - seat.streetContributed)
  const stack = seat.stack

  // Special case: BB with option when everyone limps (preflop, no raise)
  const isBBWithOption = state.street === 'PREFLOP' &&
                         seatIndex === state.bbIndex &&
                         state.currentBet === state.config.blinds.bb &&
                         toCall === 0

  // Can fold unless BB with option (no one raised)
  result.canFold = !isBBWithOption && toCall > 0

  if (toCall === 0) {
    // No bet to call - can check
    result.canCheck = true

    // Can bet if unopened and have chips
    if (state.currentBet === 0 && stack > 0) {
      result.canBet = true
      // Min bet is BB size (or all stack if less)
      result.minBet = Math.min(state.config.blinds.bb, stack)
      // Don't set canRaise when there's no bet - use BET instead
      result.canRaise = false
    } else if (state.currentBet > 0 && stack > 0 && state.bettingReopened) {
      // Can raise even when caught up (option to raise) - but only if betting is open
      result.canRaise = true
      const minRaiseAmount = state.lastRaiseSize || state.config.blinds.bb
      result.minRaiseTo = Math.min(state.currentBet + minRaiseAmount, seat.streetContributed + stack)
      result.maxRaiseTo = seat.streetContributed + stack
    }
  } else {
    // There's a bet to call - always can fold
    result.canFold = true

    if (stack > 0) {
      const callCost = Math.min(toCall, stack)
      result.canCall = true
      result.callAmount = callCost

      // Can raise if we have enough chips and betting is open
      if (state.bettingReopened) {
        const minRaiseAmount = state.lastRaiseSize || state.config.blinds.bb
        const minRaiseTotal = state.currentBet + minRaiseAmount

        if (stack > toCall) {
          // Have chips beyond the call - can always raise (all-in if needed)
          result.canRaise = true
          if (stack >= minRaiseTotal - seat.streetContributed) {
            // Have enough for a legal raise
            result.minRaiseTo = minRaiseTotal
          } else {
            // Can only go all-in for less
            result.minRaiseTo = seat.streetContributed + stack
          }
          result.maxRaiseTo = seat.streetContributed + stack
        }
      }
    }
  }

  return result
}