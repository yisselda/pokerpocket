import type { GameState, Player } from './types'

export function countActive(players: Player[]) {
  return players.filter(p => !p.folded && !p.allIn).length
}

export function onlyOneNonFolded(players: Player[]) {
  return players.filter(p => !p.folded).length === 1
}

export function isBettingRoundComplete(players: Player[]) {
  // All active players have matched the max bet or are all-in
  const maxBet = Math.max(...players.map(p => p.bet))
  return players.every(p => p.folded || p.allIn || p.bet === maxBet)
}

export function nextActorIndex(players: Player[], start: number): number {
  for (let i = 1; i <= players.length; i++) {
    const idx = (start + i) % players.length
    const p = players[idx]
    if (!p.folded && !p.allIn) return idx
  }
  return start // fallback
}

// Has action returned to refSeat?
// i.e. is it refSeat's turn to act again?
// Note: this does NOT check if refSeat can actually act (they may be folded/all-in)
export function returnedTo(
  refSeat: number,
  toAct: number,
  players: Player[]
): boolean {
  // In most engines, "returned" means the next to act is the aggressor (they have action),
  // i.e., the previous player just acted and now it's refSeat's turn again.
  return toAct === refSeat
}

export function everyoneMatchedTarget(players: Player[], targetBet: number) {
  return players.every(p => p.folded || p.allIn || p.bet === targetBet)
}

// Should we close the betting round?
// Conditions:
// - only one player not folded (hand over)
// - everyone has matched the target bet (or is all-in) AND action has returned to lastAggressor or roundStart
export function shouldCloseBetting(
  state: GameState & { tag: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' }
): boolean {
  const { players, targetBet, lastAggressor, roundStart, toAct } = state
  if (onlyOneNonFolded(players)) return true
  if (countActive(players) === 0) return true
  if (!everyoneMatchedTarget(players, targetBet)) return false

  const ref = lastAggressor ?? roundStart
  return returnedTo(ref, toAct, players)
}
