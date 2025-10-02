export interface RNG {
  /**
   * Returns the next pseudo-random number in [0, 1).
   */
  next(): number
  /**
   * Returns the internal state as an unsigned 32-bit integer so it can be
   * persisted and restored later.
   */
  getState(): number
  /**
   * Restores the internal state from a previously serialized value.
   */
  setState(state: number): void
}

const MULTIPLIER = 1664525
const INCREMENT = 1013904223
const MAX_UINT32 = 0x100000000

/**
 * Simple, fast linear congruential generator. Matches the legacy engine and is
 * good enough for deterministic shuffles and tests.
 */
export class LcgRng implements RNG {
  private state: number

  constructor(seed?: number) {
    const initial = seed ?? Date.now() >>> 0
    this.state = initial >>> 0
  }

  next(): number {
    this.state = (this.state * MULTIPLIER + INCREMENT) >>> 0
    return this.state / MAX_UINT32
  }

  getState(): number {
    return this.state >>> 0
  }

  setState(state: number): void {
    this.state = state >>> 0
  }
}

/**
 * Helper to construct a deterministic RNG with a specific seed.
 */
export function withSeed(seed: number): RNG {
  return new LcgRng(seed)
}

/**
 * Serializes the RNG held on the game state so callers can snapshot it and
 * resume the stream later. Returns undefined if the state does not expose an
 * RNG (e.g., legacy callers).
 */
export function serializeRng(state: { rng?: RNG }): number | undefined {
  const rng = state.rng
  if (!rng) return undefined
  return rng.getState()
}

/**
 * Ensures the table has an RNG instance. If one is already present it will be
 * returned, otherwise a new default instance will be created seeded with
 * Date.now(). The returned RNG has its state synchronized with the given seed
 * value when provided.
 */
export function ensureRng(rng: RNG | undefined, seed: number | undefined): RNG {
  if (rng) {
    if (typeof seed === 'number') rng.setState(seed)
    return rng
  }
  return new LcgRng(seed)
}
