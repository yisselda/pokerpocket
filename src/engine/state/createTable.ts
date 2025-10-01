import { TableConfig, TableState, Seat, Rng } from '../betting/types.js'
import { LCG } from '../../rng.js'
import { createDeck, shuffle, draw } from '../../deck.js'
import { Card } from '../../types.js'

/**
 * Adapter for existing RNG to match Rng interface
 */
class RngAdapter implements Rng {
  private rng: LCG
  private deck: Card[] | null = null

  constructor(seed?: number | string) {
    this.rng = new LCG()
    if (seed !== undefined) {
      const numSeed = typeof seed === 'string' ? hashString(seed) : seed
      this.rng.seed(numSeed)
    }
  }

  reset(): void {
    // Force a new deck to be created on next draw
    this.deck = null
  }

  draw(count: number): Card[] {
    // Create and shuffle a new deck if needed
    if (this.deck === null) {
      this.deck = createDeck()
      shuffle(this.deck, this.rng)
    }

    // Draw cards from the existing deck
    return draw(this.deck, count)
  }
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Creates a new table with the given configuration
 */
export function createTable(config: TableConfig): TableState {
  // Validate config
  if (config.maxSeats < 2 || config.maxSeats > 9) {
    throw new Error('maxSeats must be between 2 and 9')
  }
  if (config.blinds.sb <= 0 || config.blinds.bb <= 0) {
    throw new Error('Blinds must be positive')
  }
  if (config.ante !== undefined && config.ante < 0) {
    throw new Error('Ante cannot be negative')
  }

  // Set up RNG
  const finalRng = config.rng || new RngAdapter(config.seed)

  // Initialize empty seats
  const seats: Seat[] = []
  for (let i = 0; i < config.maxSeats; i++) {
    seats.push({
      id: '',
      stack: 0,
      folded: false,
      allIn: false,
      contributed: 0,
      streetContributed: 0,
    })
  }

  // Create initial state
  const state: TableState = {
    handId: 0,
    config: {
      ...config,
      rng: finalRng,
      oddChipRule: config.oddChipRule || 'LEFT_OF_BUTTON',
    },
    button: 0,
    sbIndex: 0,
    bbIndex: 0,
    actionOn: 0,
    street: 'PREFLOP',
    board: [],
    seats,
    pots: [],
    currentBet: 0,
    lastRaiseSize: 0,
    bettingReopened: true,
    hasActedThisRound: new Set<number>(),
    history: [],
  }

  return state
}