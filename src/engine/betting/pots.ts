import { TableState, Pot } from './types.js'

/**
 * Computes side pots based on player contributions
 *
 * Algorithm:
 * 1. Sort players by contribution amount (ascending)
 * 2. For each contribution level, create a pot
 * 3. Track which players are eligible for each pot
 */
export function computePots(state: TableState): Pot[] {
  const pots: Pot[] = []

  // Collect all players with contributions
  const contributors = state.seats
    .map((seat, idx) => ({
      seatIndex: idx,
      seatId: seat.id,
      contribution: seat.contributed,
      folded: seat.folded,
      allIn: seat.allIn,
    }))
    .filter(p => p.contribution > 0)
    .sort((a, b) => a.contribution - b.contribution)

  if (contributors.length === 0) {
    return []
  }

  let previousLevel = 0

  for (let i = 0; i < contributors.length; i++) {
    const contributor = contributors[i]
    const currentLevel = contributor.contribution
    const levelDiff = currentLevel - previousLevel

    if (levelDiff > 0) {
      // Count how many players contribute to this pot level
      const contributorsAtLevel = contributors.slice(i)
      const eligiblePlayers = contributorsAtLevel
        .filter(p => !p.folded)
        .map(p => p.seatId)

      // Calculate pot amount
      // Everyone from index i onwards contributes levelDiff to this pot
      const potAmount = levelDiff * contributorsAtLevel.length

      if (potAmount > 0) {
        pots.push({
          amount: potAmount,
          eligible: eligiblePlayers,
        })
      }
    }

    previousLevel = currentLevel
  }

  // Merge pots with same eligible players (optimization)
  const mergedPots: Pot[] = []
  for (const pot of pots) {
    const existingPot = mergedPots.find(
      p => p.eligible.length === pot.eligible.length &&
           p.eligible.every(id => pot.eligible.includes(id))
    )

    if (existingPot) {
      existingPot.amount += pot.amount
    } else {
      mergedPots.push({
        amount: pot.amount,
        eligible: [...pot.eligible],
      })
    }
  }

  return mergedPots
}

/**
 * Updates the pots in the state
 */
export function updatePots(state: TableState): TableState {
  return {
    ...state,
    pots: computePots(state),
  }
}