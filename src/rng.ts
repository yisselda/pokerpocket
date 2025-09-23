export interface RNG {
  seed(n: number): void
  next(): number
  randInt(n: number): number
}

export class LCG implements RNG {
  private state: number

  constructor(seed?: number) {
    this.state = (seed ?? Date.now() >>> 0) >>> 0
  }

  seed(n: number): void {
    this.state = n >>> 0
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0
    return this.state / 0x100000000
  }

  randInt(n: number): number {
    return Math.floor(this.next() * n)
  }
}
