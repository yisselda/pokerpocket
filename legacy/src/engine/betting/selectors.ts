import { TableState } from './types.js'

/**
 * Helper selectors for UI ergonomics
 */
export const selectors = {
  toCall(state: TableState, seat: number): number {
    if (seat < 0 || seat >= state.config.maxSeats) {
      return 0
    }
    const seatData = state.seats[seat]
    if (seatData.id === '' || seatData.folded || seatData.allIn) {
      return 0
    }
    return Math.max(0, state.currentBet - seatData.streetContributed)
  },

  isRoundClosed(state: TableState): boolean {
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

    // Also need to check that everyone has had a chance to act
    // This is tracked by checking if we've gone around once since last raise
    // For now, we'll assume round is complete if all active players matched bet
    return true
  },

  nextToAct(state: TableState): number | null {
    if (state.street === 'COMPLETE' || this.isRoundClosed(state)) {
      return null
    }
    return state.actionOn
  },

  minRaiseTo(state: TableState): number {
    return state.currentBet + (state.lastRaiseSize || state.config.blinds.bb)
  },
}