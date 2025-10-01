import type { Player } from './types'

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
