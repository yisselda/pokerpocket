import { TableState, ActionEvent, Pot } from './types.js'
import { evaluateSeven } from '../../evaluator.js'
import { Card } from '../../types.js'

/**
 * Determines winners for a pot and returns the seat IDs of winners
 */
function determineWinners(
  state: TableState,
  pot: Pot
): { seatId: string; handValue: number }[] {
  const eligibleHands = pot.eligible
    .map(seatId => {
      const seat = state.seats.find(s => s.id === seatId)
      if (!seat || !seat.hole) {
        return null
      }

      // Combine hole cards with board
      const allCards = [...seat.hole, ...state.board] as Card[]

      // Evaluate the hand
      const evaluation = evaluateSeven(allCards)

      // Convert to numeric value (higher is better)
      const handRankValues: Record<string, number> = {
        STRAIGHT_FLUSH: 8,
        FOUR_OF_A_KIND: 7,
        FULL_HOUSE: 6,
        FLUSH: 5,
        STRAIGHT: 4,
        THREE_OF_A_KIND: 3,
        TWO_PAIR: 2,
        ONE_PAIR: 1,
        HIGH_CARD: 0,
      }

      // Create a comparable value (higher = better)
      let handValue = handRankValues[evaluation.rank] * 1000000

      // Add tiebreaker values
      for (let i = 0; i < evaluation.tiebreak.length; i++) {
        handValue += evaluation.tiebreak[i] * Math.pow(100, 4 - i)
      }

      return {
        seatId,
        handValue,
        rank: evaluation.rank,
      }
    })
    .filter(Boolean) as { seatId: string; handValue: number; rank: any }[]

  if (eligibleHands.length === 0) {
    return []
  }

  // Find the best hand value (highest number wins)
  const bestValue = Math.max(...eligibleHands.map(h => h.handValue))

  // Return all players with the best hand
  return eligibleHands
    .filter(h => h.handValue === bestValue)
    .map(h => ({ seatId: h.seatId, handValue: h.handValue }))
}

/**
 * Distributes a pot among winners, handling odd chips
 */
function distributePot(
  state: TableState,
  pot: Pot,
  winners: { seatId: string; handValue: number }[]
): { seatId: string; amount: number }[] {
  if (winners.length === 0) {
    return []
  }

  const baseAmount = Math.floor(pot.amount / winners.length)
  const remainder = pot.amount % winners.length

  const distributions: { seatId: string; amount: number }[] = []

  // Give base amount to all winners
  for (const winner of winners) {
    distributions.push({
      seatId: winner.seatId,
      amount: baseAmount,
    })
  }

  // Handle odd chips - give to winner(s) in order left of button
  if (remainder > 0) {
    // Sort winners by position from button
    const sortedWinners = [...winners].sort((a, b) => {
      const aIdx = state.seats.findIndex(s => s.id === a.seatId)
      const bIdx = state.seats.findIndex(s => s.id === b.seatId)

      // Calculate distance from button
      const aDistance =
        (aIdx - state.button + state.config.maxSeats) % state.config.maxSeats
      const bDistance =
        (bIdx - state.button + state.config.maxSeats) % state.config.maxSeats

      return aDistance - bDistance
    })

    // Give odd chips to first N winners (left of button)
    for (let i = 0; i < remainder; i++) {
      const winner = sortedWinners[i % sortedWinners.length]
      const dist = distributions.find(d => d.seatId === winner.seatId)
      if (dist) {
        dist.amount += 1
      }
    }
  }

  return distributions
}

/**
 * Processes showdown - determines winners and awards pots
 */
export function processShowdown(state: TableState): TableState {
  const newState = { ...state }
  const allWinners: { seatId: string; amount: number }[] = []
  const events: ActionEvent[] = []

  // Process each pot
  for (let i = 0; i < state.pots.length; i++) {
    const pot = state.pots[i]

    // Skip empty pots
    if (pot.amount === 0) {
      continue
    }

    // Determine winners for this pot
    const winners = determineWinners(state, pot)

    // Distribute the pot
    const distributions = distributePot(state, pot, winners)

    // Award chips to winners
    for (const dist of distributions) {
      const seatIdx = state.seats.findIndex(s => s.id === dist.seatId)
      if (seatIdx !== -1) {
        newState.seats[seatIdx].stack += dist.amount

        // Aggregate winnings
        const existing = allWinners.find(w => w.seatId === dist.seatId)
        if (existing) {
          existing.amount += dist.amount
        } else {
          allWinners.push({ ...dist })
        }
      }
    }

    // Add award event for this pot
    if (distributions.length > 0) {
      events.push({
        at: newState.history.length + events.length,
        kind: 'AWARD',
        data: {
          potIndex: i,
          winners: distributions,
          reason: 'showdown',
        },
      })
    }
  }

  // Update state with winners and events
  newState.winners = allWinners
  newState.history = [...newState.history, ...events]
  newState.street = 'COMPLETE'

  // Clear contributions for next hand
  newState.seats = newState.seats.map(seat => ({
    ...seat,
    contributed: 0,
    streetContributed: 0,
  }))

  return newState
}

/**
 * Checks if hand should go to showdown
 */
export function shouldShowdown(state: TableState): boolean {
  // Check if we're at the river and action is complete
  if (state.street !== 'RIVER') {
    return false
  }

  // Count non-folded players
  const nonFoldedPlayers = state.seats.filter(s => s.id !== '' && !s.folded)

  // Need at least 2 players for showdown
  return nonFoldedPlayers.length >= 2
}
