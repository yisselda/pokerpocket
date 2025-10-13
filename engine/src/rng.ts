export interface RNG {
  /** Returns the next pseudo-random number in [0, 1). */
  next(): number
  /** Returns the internal state as an unsigned 32-bit integer. */
  getState(): number
  /** Restores the internal state from a previously serialized value. */
  setState(state: number): void
  /** Optional helper for integer ranges. */
  randInt?(n: number): number
}

const MULTIPLIER = 1664525
const INCREMENT = 1013904223
const MAX_UINT32 = 0x100000000

/** Fast, deterministic LCG. Not cryptographically secure. */
export class LcgRng implements RNG {
  private state: number

  constructor(seed?: number) {
    const initial = seed ?? Date.now() >>> 0
    this.state = initial >>> 0
  }

  next(): number {
    this.state = (Math.imul(this.state, MULTIPLIER) + INCREMENT) >>> 0
    return this.state / MAX_UINT32
  }

  getState(): number {
    return this.state >>> 0
  }

  setState(state: number): void {
    this.state = state >>> 0
  }

  randInt(n: number): number {
    if (!Number.isInteger(n) || n <= 0) {
      throw new RangeError('n must be a positive integer')
    }
    return Math.floor(this.next() * n) >>> 0
  }

  static fromState(state: number): LcgRng {
    const rng = new LcgRng()
    rng.setState(state)
    return rng
  }
}

export function withSeed(seed: number): RNG {
  return new LcgRng(seed)
}

export function ensureRng(rng: RNG | undefined, seed: number | undefined): RNG {
  if (rng) {
    if (typeof seed === 'number') rng.setState(seed >>> 0)
    return rng
  }
  return new LcgRng(seed)
}

export function serializeRng(state: { rng?: RNG }): number | undefined {
  return state.rng?.getState()
}

export function getSeed(state: { rng?: RNG }): number | undefined {
  return serializeRng(state)
}
