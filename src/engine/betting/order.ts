import { TableState, ActionEvent } from './types.js'
import { Card } from '../../types.js'
import { processShowdown } from './showdown.js'

/**
 * Turn order and round closure management
 */
export function getNextActor(state: TableState, afterSeat: number): number | null {
  const maxSeats = state.config.maxSeats
  let nextSeat = (afterSeat + 1) % maxSeats
  let attempts = 0

  while (attempts < maxSeats) {
    const seat = state.seats[nextSeat]
    // Skip empty seats, eliminated players (stack=0), folded, and all-in
    if (seat.id !== '' && seat.stack > 0 && !seat.folded && !seat.allIn) {
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

  // Special case for preflop: BB gets option even if all called
  if (state.street === 'PREFLOP' && state.currentBet === state.config.blinds?.bb) {
    // BB hasn't acted yet if not in hasActedThisRound
    const bb = state.seats[state.bbIndex]
    if (bb && !bb.folded && !bb.allIn) {
      if (!state.hasActedThisRound.has(state.bbIndex)) {
        return false // BB gets to act
      }
    }
  }

  // If no bet on this street, require everyone to have acted
  if (state.currentBet === 0) {
    for (let i = 0; i < state.config.maxSeats; i++) {
      const s = state.seats[i]
      if (s.id !== '' && !s.folded && !s.allIn && !state.hasActedThisRound.has(i)) {
        return false
      }
    }
    return true
  }

  // There is a live bet: require both matched chips and acted-since-reopen
  for (let i = 0; i < state.config.maxSeats; i++) {
    const s = state.seats[i]
    if (s.id !== '' && !s.folded && !s.allIn) {
      if (s.streetContributed < state.currentBet) return false
      if (!state.hasActedThisRound.has(i)) return false
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
        // Check if we should go to showdown
        const nonFolded = newState.seats.filter(s => s.id !== '' && !s.folded)
        if (nonFolded.length >= 2) {
          // Go to showdown
          return processShowdown(newState)
        } else {
          // Complete the hand (only one player left)
          newState.street = 'COMPLETE'
        }
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
    newState.bettingReopened = true  // Reset for new street
    newState.hasActedThisRound = new Set<number>()  // Reset who has acted

    // Reset street contributions
    newState.seats = newState.seats.map(seat => ({
      ...seat,
      streetContributed: 0,
    }))

    // Check if any players can still act (not folded, not all-in)
    const activePlayersCanAct = newState.seats.some(
      s => s.id !== '' && !s.folded && !s.allIn
    )

    if (activePlayersCanAct) {
      // Set first to act (left of button for postflop)
      // Only count players with chips as active
      const isHeadsUp = newState.seats.filter(s => s.id !== '' && !s.folded).length === 2

      if (isHeadsUp) {
        // Heads-up: SB (button) acts first postflop
        let sbCanAct = !newState.seats[newState.sbIndex].folded && !newState.seats[newState.sbIndex].allIn
        if (sbCanAct) {
          newState.actionOn = newState.sbIndex
        } else {
          // Find other player who can act
          let bbCanAct = !newState.seats[newState.bbIndex].folded && !newState.seats[newState.bbIndex].allIn
          if (bbCanAct) {
            newState.actionOn = newState.bbIndex
          }
        }
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
    }
    // If no one can act, actionOn stays as is (will be ignored since round is complete)

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