import { TableState, Action, ActionEvent } from './types.js'
import { initHand } from '../state/initHand.js'
import { getNextActor, isRoundComplete, advanceStreet } from './order.js'

/**
 * Helper to handle post-action state updates
 */
function handleActionComplete(state: TableState, lastActor: number): TableState {
  // Check if round is complete
  if (isRoundComplete(state)) {
    // Check if only one non-folded player remains
    const nonFoldedPlayers = state.seats.filter(
      s => s.id !== '' && !s.folded
    )

    if (nonFoldedPlayers.length === 1) {
      // Award pot to last player
      const winner = nonFoldedPlayers[0]
      const totalPot = state.seats.reduce(
        (sum, s) => sum + s.contributed,
        0
      )

      winner.stack += totalPot

      const newState = {
        ...state,
        winners: [{
          seatId: winner.id,
          amount: totalPot,
        }],
        street: 'COMPLETE' as const,
      }

      // Add award event
      const awardEvent: ActionEvent = {
        at: newState.history.length,
        kind: 'AWARD',
        data: {
          winners: newState.winners,
          reason: 'all_folded',
        },
      }
      newState.history = [...newState.history, awardEvent]

      return newState
    }

    // Advance to next street
    return advanceStreet(state)
  }

  // Find next actor
  const nextActor = getNextActor(state, lastActor)
  if (nextActor === null) {
    // No more actors, advance street
    return advanceStreet(state)
  }

  return {
    ...state,
    actionOn: nextActor,
  }
}

/**
 * Main reducer function - applies actions to table state
 */
export function reduce(state: TableState, action: Action): TableState {
  // Clone state for immutability
  const newState: TableState = {
    ...state,
    seats: [...state.seats],
    history: [...state.history],
  }

  switch (action.type) {
    case 'SIT': {
      const { seat, buyin, name } = action

      // Validation
      if (seat < 0 || seat >= state.config.maxSeats) {
        throw new Error(`Seat ${seat} is out of range`)
      }
      if (newState.seats[seat].id !== '') {
        throw new Error(`Seat ${seat} is already occupied`)
      }
      if (buyin <= 0) {
        throw new Error('Buyin must be positive')
      }

      // Update seat
      newState.seats[seat] = {
        id: `seat_${seat}`,
        name: name || `Player${seat}`,
        stack: buyin,
        folded: false,
        allIn: false,
        contributed: 0,
        streetContributed: 0,
      }

      // Add event to history
      const event: ActionEvent = {
        at: newState.history.length,
        seat,
        kind: 'SIT',
        data: { buyin, name },
      }
      newState.history.push(event)

      return newState
    }

    case 'LEAVE': {
      const { seat } = action

      // Validation
      if (seat < 0 || seat >= state.config.maxSeats) {
        throw new Error(`Seat ${seat} is out of range`)
      }
      if (newState.seats[seat].id === '') {
        throw new Error(`Seat ${seat} is already empty`)
      }
      if (state.street !== 'COMPLETE' && state.street !== 'PREFLOP') {
        // Only allow leaving between hands
        if (state.handId > 0) {
          throw new Error('Cannot leave mid-hand')
        }
      }

      // Clear seat
      newState.seats[seat] = {
        id: '',
        stack: 0,
        folded: false,
        allIn: false,
        contributed: 0,
        streetContributed: 0,
      }

      // Add event to history
      const event: ActionEvent = {
        at: newState.history.length,
        seat,
        kind: 'LEAVE',
      }
      newState.history.push(event)

      return newState
    }

    case 'START_HAND': {
      // Can only start hand when previous is complete or at beginning
      if (state.handId > 0 && state.street !== 'COMPLETE') {
        throw new Error('Previous hand must be complete')
      }

      return initHand(state)
    }

    case 'CHECK': {
      const { seat } = action

      // Validation
      if (seat !== state.actionOn) {
        throw new Error('Not your turn to act')
      }
      const seatData = newState.seats[seat]
      if (seatData.folded || seatData.allIn) {
        throw new Error('Cannot act when folded or all-in')
      }
      const toCall = state.currentBet - seatData.streetContributed
      if (toCall > 0) {
        throw new Error('Cannot check when there is a bet to call')
      }

      // Add event
      const event: ActionEvent = {
        at: newState.history.length,
        seat,
        kind: 'CHECK',
      }
      newState.history.push(event)

      // Advance action or street
      return handleActionComplete(newState, seat)
    }

    case 'CALL': {
      const { seat } = action

      // Validation
      if (seat !== state.actionOn) {
        throw new Error('Not your turn to act')
      }
      const seatData = newState.seats[seat]
      if (seatData.folded || seatData.allIn) {
        throw new Error('Cannot act when folded or all-in')
      }
      const toCall = state.currentBet - seatData.streetContributed
      if (toCall <= 0) {
        throw new Error('No bet to call')
      }

      // Process call
      const callAmount = Math.min(toCall, seatData.stack)
      seatData.stack -= callAmount
      seatData.contributed += callAmount
      seatData.streetContributed += callAmount

      if (seatData.stack === 0) {
        seatData.allIn = true
      }

      // Add event
      const event: ActionEvent = {
        at: newState.history.length,
        seat,
        kind: 'CALL',
        data: { amount: callAmount },
      }
      newState.history.push(event)

      // Advance action or street
      return handleActionComplete(newState, seat)
    }

    case 'BET': {
      const { seat, to } = action

      // Validation
      if (seat !== state.actionOn) {
        throw new Error('Not your turn to act')
      }
      const seatData = newState.seats[seat]
      if (seatData.folded || seatData.allIn) {
        throw new Error('Cannot act when folded or all-in')
      }
      if (state.currentBet > 0) {
        throw new Error('Cannot bet when there is already a bet (use raise)')
      }
      if (to <= 0 || to > seatData.stack) {
        throw new Error('Invalid bet amount')
      }

      // Process bet
      seatData.stack -= to
      seatData.contributed += to
      seatData.streetContributed += to
      newState.currentBet = to
      newState.lastRaiseSize = to

      if (seatData.stack === 0) {
        seatData.allIn = true
      }

      // Add event
      const event: ActionEvent = {
        at: newState.history.length,
        seat,
        kind: 'BET',
        data: { to },
      }
      newState.history.push(event)

      // Advance action
      return handleActionComplete(newState, seat)
    }

    case 'RAISE': {
      const { seat, to } = action

      // Validation
      if (seat !== state.actionOn) {
        throw new Error('Not your turn to act')
      }
      const seatData = newState.seats[seat]
      if (seatData.folded || seatData.allIn) {
        throw new Error('Cannot act when folded or all-in')
      }
      if (state.currentBet === 0) {
        throw new Error('Cannot raise when there is no bet (use bet)')
      }

      const toCall = state.currentBet - seatData.streetContributed
      const raiseAmount = to - seatData.streetContributed

      if (raiseAmount <= toCall) {
        throw new Error('Raise must be larger than call amount')
      }
      if (raiseAmount > seatData.stack) {
        throw new Error('Insufficient stack for raise')
      }

      // Process raise
      seatData.stack -= raiseAmount
      seatData.contributed += raiseAmount
      seatData.streetContributed += raiseAmount

      const previousBet = newState.currentBet
      newState.currentBet = to
      newState.lastRaiseSize = to - previousBet

      if (seatData.stack === 0) {
        seatData.allIn = true
      }

      // Add event
      const event: ActionEvent = {
        at: newState.history.length,
        seat,
        kind: 'RAISE',
        data: { to },
      }
      newState.history.push(event)

      // Advance action
      return handleActionComplete(newState, seat)
    }

    case 'ALL_IN': {
      const { seat, to } = action

      // Validation
      if (seat !== state.actionOn) {
        throw new Error('Not your turn to act')
      }
      const seatData = newState.seats[seat]
      if (seatData.folded || seatData.allIn) {
        throw new Error('Cannot act when folded or already all-in')
      }

      // Process all-in
      const allInAmount = seatData.stack
      seatData.stack = 0
      seatData.contributed += allInAmount
      seatData.streetContributed += allInAmount
      seatData.allIn = true

      const totalCommitted = seatData.streetContributed

      // Update current bet if this is higher
      if (totalCommitted > newState.currentBet) {
        const raise = totalCommitted - newState.currentBet
        newState.lastRaiseSize = raise
        newState.currentBet = totalCommitted
      }

      // Add event
      const event: ActionEvent = {
        at: newState.history.length,
        seat,
        kind: 'ALL_IN',
        data: { amount: allInAmount, total: totalCommitted },
      }
      newState.history.push(event)

      // Advance action
      return handleActionComplete(newState, seat)
    }

    case 'FOLD': {
      const { seat } = action

      // Validation
      if (seat !== state.actionOn) {
        throw new Error('Not your turn to act')
      }
      const seatData = newState.seats[seat]
      if (seatData.folded) {
        throw new Error('Already folded')
      }

      // Process fold
      seatData.folded = true

      // Add event
      const event: ActionEvent = {
        at: newState.history.length,
        seat,
        kind: 'FOLD',
      }
      newState.history.push(event)

      // Check for immediate win
      const nonFoldedPlayers = newState.seats.filter(
        s => s.id !== '' && !s.folded
      )

      if (nonFoldedPlayers.length === 1) {
        // Award pot to last player
        const winner = nonFoldedPlayers[0]
        const winnerIndex = newState.seats.indexOf(winner)
        const totalPot = newState.seats.reduce(
          (sum, s) => sum + s.contributed,
          0
        )

        winner.stack += totalPot

        newState.winners = [{
          seatId: winner.id,
          amount: totalPot,
        }]

        newState.street = 'COMPLETE'

        // Add award event
        const awardEvent: ActionEvent = {
          at: newState.history.length + 1,
          kind: 'AWARD',
          data: {
            winners: newState.winners,
            reason: 'all_folded',
          },
        }
        newState.history.push(awardEvent)

        return newState
      }

      // Advance action
      return handleActionComplete(newState, seat)
    }

    case 'MUCK':
    case 'REVEAL':
      // TODO: Implement showdown actions
      throw new Error(`Action ${action.type} not yet implemented`)

    default:
      // Exhaustive check
      const _exhaustive: never = action
      throw new Error(`Unknown action type`)
  }
}