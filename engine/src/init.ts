import type { GameState, Player } from './types.js'

export function createPlayers(n: number, chips: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    name: `P${i + 1}`,
    stack: chips,
    bet: 0,
    contributed: 0,
    folded: false,
    allIn: false,
  }))
}

export function createTable(
  nbPlayers: number,
  chips: number,
  bigBlind: number
): GameState {
  return {
    tag: 'INIT',
    players: createPlayers(nbPlayers, chips),
    bigBlind,
    dealer: 0,
  }
}
