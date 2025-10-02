import type { GameState, Player } from './types.js'
import type { RNG } from './rng.js'
import { ensureRng } from './rng.js'

export interface CreateTableOptions {
  rng?: RNG
  seed?: number
}

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
  bigBlind: number,
  opts: CreateTableOptions = {}
): GameState {
  const rng = ensureRng(opts.rng, opts.seed)
  return {
    tag: 'INIT',
    players: createPlayers(nbPlayers, chips),
    bigBlind,
    dealer: 0,
    rng,
  }
}
