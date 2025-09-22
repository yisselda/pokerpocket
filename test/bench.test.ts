import { describe, it, expect } from 'vitest'
import { Bench } from 'tinybench'
import { PokerEngine } from '../src/engine.js'

/**
 * Simulate a complete hand from deal to showdown
 * @param n Number of players
 * @returns void (function just runs the complete sequence)
 */
function simulateHand(n: number): void {
  const engine = new PokerEngine()
  engine.setPlayers(n)
  engine.setSeed(1)

  // Complete hand sequence: deal → flop → turn → river → showdown
  engine.deal()
  engine.flop()
  engine.turn()
  engine.river()
  engine.showdown()
}

describe.runIf(!process.env.CI)('Micro-benchmarks', () => {
  it('deal→showdown (9 players) performance benchmark', async () => {
    const bench = new Bench({ time: 1000 })

    bench.add('deal→showdown (9 players)', () => {
      simulateHand(9)
    })

    await bench.run()

    // Get results
    const results = bench.results
    expect(results).toHaveLength(1)

    const task = results[0]
    const hz = task.hz || 0

    // Log the benchmark results for visibility
    console.log(`\nBenchmark Results:`)
    console.log(`Task: deal→showdown (9 players)`)
    console.log(`Hz: ${hz.toFixed(2)} ops/sec`)
    console.log(`Mean: ${((task.mean || 0) * 1000).toFixed(2)}ms per operation`)
    console.log(`Standard Deviation: ${((task.sd || 0) * 1000).toFixed(2)}ms`)

    // Expect at least 20 operations per second (< 50ms per hand)
    // Use lower threshold on CI or if CI env var is set
    const threshold = process.env.CI ? 10 : 20
    expect(hz).toBeGreaterThan(threshold)
  }, 10000) // Allow up to 10 seconds for benchmark
})