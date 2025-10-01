import type { GameState, Player } from './types.js'

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
function nextActiveSeat(players: Player[], start: number) {
  for (let i = 1; i <= players.length; i++) {
    const idx = (start + i) % players.length
    const p = players[idx]
    if (!p.folded && !p.allIn) return idx
  }
  return start
}

function prevActiveSeat(players: Player[], start: number) {
  for (let i = 1; i <= players.length; i++) {
    const idx = (start - i + players.length) % players.length
    const p = players[idx]
    if (!p.folded && !p.allIn) return idx
  }
  return start
}

export function returnedTo(
  refSeat: number,
  toAct: number,
  players: Player[],
  justActed: number
): boolean {
  const refPlayer = players[refSeat]
  const refCanAct = !!refPlayer && !refPlayer.folded && !refPlayer.allIn

  const expected = refCanAct ? refSeat : nextActiveSeat(players, refSeat)
  const previous = prevActiveSeat(players, expected)
  return toAct === expected && justActed === previous
}

export function everyoneMatchedTarget(players: Player[], targetBet: number) {
  return players.every(p => p.folded || p.allIn || p.bet === targetBet)
}

// Should we close the betting round?
// Conditions:
// - only one player not folded (hand over)
// - everyone has matched the target bet (or is all-in) AND action has returned to lastAggressor or roundStart
export function shouldCloseBetting(
  state: GameState & { tag: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' },
  justActed: number
): boolean {
  const { players, targetBet, lastAggressor, roundStart, toAct } = state
  if (onlyOneNonFolded(players)) return true
  if (countActive(players) === 0) return true
  if (!everyoneMatchedTarget(players, targetBet)) return false

  const ref = lastAggressor ?? roundStart
  return returnedTo(ref, toAct, players, justActed)
}

// Are all remaining players either folded or all-in
export function noFurtherActionsPossible(players: Player[]): boolean {
  const alive = players.filter(p => !p.folded)
  if (alive.length < 2) return false // hand ends via fold logic elsewhere
  const canAct = alive.filter(p => !p.allIn)
  return canAct.length === 0
}
