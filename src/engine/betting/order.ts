import { TableState, ActionEvent } from './types.js'
import { Card } from '../../types.js'

/**
 * Turn order and round closure management
 */
export function getNextActor(state: TableState, afterSeat: number): number | null {
  const maxSeats = state.config.maxSeats
  let nextSeat = (afterSeat + 1) % maxSeats
  let attempts = 0

  while (attempts < maxSeats) {
    const seat = state.seats[nextSeat]
    if (seat.id !== '' && !seat.folded && !seat.allIn) {
      return nextSeat
    }
    nextSeat = (nextSeat + 1) % maxSeats
    attempts++
  }

  return null
}

export function isRoundComplete(state: TableState): boolean {
  // Count active players (not folded, not all-in)
  const activePlayers = state.seats.filter(
    s => s.id !== '' && !s.folded && !s.allIn
  )

  // No active players or only one player left (others folded)
  if (activePlayers.length === 0) {
    return true
  }

  const nonFoldedPlayers = state.seats.filter(
    s => s.id !== '' && !s.folded
  )
  if (nonFoldedPlayers.length <= 1) {
    return true
  }

  // Check if all active players have matched the current bet
  for (const player of activePlayers) {
    if (player.streetContributed < state.currentBet) {
      return false
    }
  }

  return true
}

export function advanceStreet(state: TableState): TableState {
  const newState = { ...state }

  // Deal cards based on current street
  if (state.config.rng) {
    switch (state.street) {
      case 'PREFLOP':
        // Deal flop (3 cards)
        const flop = state.config.rng.draw(3)
        newState.board = [...flop]
        newState.street = 'FLOP'
        break

      case 'FLOP':
        // Deal turn (1 card)
        const turn = state.config.rng.draw(1)
        newState.board = [...state.board, ...turn]
        newState.street = 'TURN'
        break

      case 'TURN':
        // Deal river (1 card)
        const river = state.config.rng.draw(1)
        newState.board = [...state.board, ...river]
        newState.street = 'RIVER'
        break

      case 'RIVER':
        // Go to showdown
        newState.street = 'SHOWDOWN'
        break

      case 'SHOWDOWN':
        // Complete the hand
        newState.street = 'COMPLETE'
        break
    }
  }

  // Reset betting for new street
  if (newState.street !== 'SHOWDOWN' && newState.street !== 'COMPLETE') {
    newState.currentBet = 0
    newState.lastRaiseSize = 0

    // Reset street contributions
    newState.seats = newState.seats.map(seat => ({
      ...seat,
      streetContributed: 0,
    }))

    // Set first to act (left of button for postflop)
    const isHeadsUp = newState.seats.filter(s => s.id !== '').length === 2

    if (isHeadsUp) {
      // Heads-up: SB (button) acts first postflop
      newState.actionOn = newState.sbIndex
    } else {
      // Find first active player left of button
      let firstToAct = (newState.button + 1) % state.config.maxSeats
      let attempts = 0

      while (attempts < state.config.maxSeats) {
        const seat = newState.seats[firstToAct]
        if (seat.id !== '' && !seat.folded && !seat.allIn) {
          newState.actionOn = firstToAct
          break
        }
        firstToAct = (firstToAct + 1) % state.config.maxSeats
        attempts++
      }
    }

    // Add ADVANCE_STREET event
    const event: ActionEvent = {
      at: newState.history.length,
      kind: 'ADVANCE_STREET',
      data: {
        street: newState.street,
        board: newState.board.map(c => `${c.rank}${c.suit}`),
      },
    }
    newState.history = [...newState.history, event]
  }

  return newState
}