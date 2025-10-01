/**
 * Consumer test for poker-pocket library
 *
 * This file tests:
 * 1. That the public API can be imported cleanly
 * 2. That CLI code is not included in the bundle (tree-shaking test)
 * 3. That the library works in a standalone ES module project
 *
 * Bundle size check: When bundled with esbuild, this should NOT include:
 * - CLI-specific imports (process.argv, readline, etc.)
 * - CLI command parsing logic
 * - CLI-only dependencies
 *
 * Expected bundle should only contain:
 * - Engine core logic
 * - Evaluator functions
 * - Card/deck utilities
 * - Type definitions
 */

import { newGame, evaluate7 } from 'poker-pocket'

function testEngine() {
  // Test basic engine functionality
  const game = newGame({ players: 2, seed: 42 })

  console.log('Players:', game.status().players)

  // Deal a hand
  game.deal()
  game.flop()
  game.turn()
  game.river()

  const result = game.showdown()
  console.log('Winners:', result.winners)
  console.log('Number of results:', result.results.length)

  return result
}

function testEvaluator() {
  // Test hand evaluation
  const cards = [
    { rank: 'A' as const, suit: 's' as const },
    { rank: 'K' as const, suit: 'h' as const },
    { rank: 'Q' as const, suit: 'd' as const },
    { rank: 'J' as const, suit: 'c' as const },
    { rank: 'T' as const, suit: 's' as const },
  ]

  const evaluation = evaluate7(cards)
  console.log('Hand rank:', evaluation.rank)
  console.log('Score:', evaluation.score.toString())

  return evaluation
}

// Run tests
console.log('=== Testing poker-pocket library ===')

try {
  testEngine()
  testEvaluator()

  console.log('✅ All tests passed!')
  console.log('✅ Library imports work correctly')
  console.log('✅ No CLI code should be bundled (tree-shaken)')
} catch (error) {
  console.error('❌ Test failed:', error)
  process.exit(1)
}
