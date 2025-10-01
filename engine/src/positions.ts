// Positions and order of action logic
// BTN: dealer
// SB: small blind (first to act preflop in heads-up)
// BB: big blind
// UTG: under the gun (first to act preflop in 3+ handed)
// MP: middle position
// CO: cutoff (seat before dealer)
export type Position = 'BTN' | 'SB' | 'BB' | 'UTG' | 'MP' | 'CO'

export function assignPositions(numPlayers: number, dealerIndex: number) {
  // Returns an array of positions by seat index.
  const pos: Position[] = Array(numPlayers).fill('UTG')
  if (numPlayers === 2) {
    // heads-up: BTN is SB, BB acts last preflop
    pos[dealerIndex] = 'BTN'
    pos[(dealerIndex + 1) % numPlayers] = 'BB'
  } else {
    pos[dealerIndex] = 'BTN'
    pos[(dealerIndex + 1) % numPlayers] = 'SB'
    pos[(dealerIndex + 2) % numPlayers] = 'BB'
  }
  return pos
}

// Returns the seat index of the first player to act preflop
export function firstToActPreflop(numPlayers: number, dealerIndex: number) {
  if (numPlayers === 2) {
    // heads-up: first to act is BTN (SB)
    return dealerIndex
  }
  // otherwise UTG = seat after BB
  return (dealerIndex + 3) % numPlayers
}
