import { TableState, Action, ActionEvent } from './types.js'
import { initHand } from '../state/initHand.js'

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

    case 'CHECK':
    case 'CALL':
    case 'BET':
    case 'RAISE':
    case 'ALL_IN':
    case 'FOLD':
    case 'MUCK':
    case 'REVEAL':
      // TODO: Implement betting actions
      throw new Error(`Action ${action.type} not yet implemented`)

    default:
      // Exhaustive check
      const _exhaustive: never = action
      throw new Error(`Unknown action type`)
  }
}