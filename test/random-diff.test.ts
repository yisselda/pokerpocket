import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { evaluateSeven } from '../src/evaluator.js'
import { Card, Rank, Suit } from '../src/types.js'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import {
  normalizeOurEval,
  normalizeTheirEval,
  evalsMatch,
  formatMismatch,
  generateRepro,
  toPokerEvaluatorCard,
} from './utils/normalize.js'

// Import poker-evaluator (CommonJS module)
const PokerEvaluator = require('poker-evaluator')

interface PendingCase {
  schema: string
  cards: string[]
  our: {
    cat: number
    ranks: number[]
    best5: string[]
  }
  their: {
    cat: number
    ranks: number[]
  }
  seed: number
  peVersion: string
  git: string
  note: string
  addedAt: string
}

const PENDING_CASES_PATH = path.join(__dirname, 'data', 'pending_cases.json')
const MAX_MISMATCHES = 10
const NUM_RUNS = process.env.DIFF_ORACLE ? 2000 : 0
const STRICT_MODE = process.env.STRICT_DIFF === '1'

// Get git commit SHA
function getGitSHA(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' })
      .trim()
      .slice(0, 7)
  } catch {
    return 'unknown'
  }
}

// Get poker-evaluator version
function getPokerEvaluatorVersion(): string {
  try {
    const packageJson = require('poker-evaluator/package.json')
    return packageJson.version || 'unknown'
  } catch {
    return 'unknown'
  }
}

// Load existing pending cases
function loadPendingCases(): PendingCase[] {
  try {
    if (fs.existsSync(PENDING_CASES_PATH)) {
      const content = fs.readFileSync(PENDING_CASES_PATH, 'utf-8')
      return JSON.parse(content)
    }
  } catch (err) {
    console.warn('Failed to load pending cases:', err)
  }
  return []
}

// Save pending cases (deduplicated)
function savePendingCases(cases: PendingCase[]): void {
  // Deduplicate by cards
  const seen = new Set<string>()
  const unique: PendingCase[] = []

  for (const c of cases) {
    const key = c.cards.join('')
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(c)
    }
  }

  // Ensure directory exists
  const dir = path.dirname(PENDING_CASES_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(PENDING_CASES_PATH, JSON.stringify(unique, null, 2))
}

// Generate 7 distinct cards
function generate7Cards(seed: number): Card[] {
  const rng = fc.Random.xoroshiro128plus(seed)

  const ranks: Rank[] = [
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'T',
    'J',
    'Q',
    'K',
    'A',
  ]
  const suits: Suit[] = ['s', 'h', 'd', 'c']

  const deck: Card[] = []
  for (const rank of ranks) {
    for (const suit of suits) {
      deck.push({ rank, suit })
    }
  }

  // Shuffle using seed
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }

  // Take first 7
  return deck.slice(0, 7)
}

describe('Random differential test against poker-evaluator', () => {
  it.skipIf(!process.env.DIFF_ORACLE)(
    'should match poker-evaluator on random deals',
    () => {
      if (NUM_RUNS === 0) {
        console.log('Skipping random diff test (set DIFF_ORACLE=1 to run)')
        return
      }

      console.log(`\nRunning ${NUM_RUNS} random differential tests...`)
      console.log(`Git SHA: ${getGitSHA()}`)
      console.log(`poker-evaluator version: ${getPokerEvaluatorVersion()}`)

      const existingPending = loadPendingCases()
      const newPending: PendingCase[] = []
      let mismatches = 0
      let tested = 0

      // Use fast-check for property-based testing with shrinking
      const property = fc.property(
        fc.integer({ min: 0, max: 2147483647 }),
        seed => {
          tested++

          // Generate 7 distinct cards
          const cards = generate7Cards(seed)

          // Evaluate with our implementation
          const ourResult = evaluateSeven(cards)
          const ourNorm = normalizeOurEval(ourResult)

          // Convert to poker-evaluator format
          const theirCards = cards.map(toPokerEvaluatorCard)

          // Evaluate with poker-evaluator
          const theirResult = PokerEvaluator.evalHand(theirCards)
          const theirNorm = normalizeTheirEval(theirResult, cards)

          // Compare
          if (!evalsMatch(ourNorm, theirNorm)) {
            mismatches++

            // Log the mismatch
            console.log(formatMismatch(cards, ourNorm, theirNorm, seed))
            console.log(`Repro: ${generateRepro(cards)}`)

            // Create pending case
            const pendingCase: PendingCase = {
              schema: 'pending-v1',
              cards: theirCards,
              our: {
                cat: ourNorm.categoryNum,
                ranks: ourNorm.ranks,
                best5: ourNorm.best5.map(toPokerEvaluatorCard),
              },
              their: {
                cat: theirNorm.categoryNum,
                ranks: theirNorm.ranks,
              },
              seed,
              peVersion: getPokerEvaluatorVersion(),
              git: getGitSHA(),
              note:
                ourNorm.category !== theirNorm.category
                  ? 'category mismatch'
                  : 'ranks mismatch',
              addedAt: new Date().toISOString(),
            }

            newPending.push(pendingCase)

            // Fail fast after MAX_MISMATCHES
            if (mismatches >= MAX_MISMATCHES) {
              console.log(`\nStopping after ${MAX_MISMATCHES} mismatches`)
              return false
            }
          }

          return true
        }
      )

      try {
        // Run the property test
        const result = fc.check(property, {
          numRuns: NUM_RUNS,
          seed: Date.now(),
          verbose: false,
          endOnFailure: false, // Continue even on failures to collect all mismatches
        })

        // Save any new pending cases
        if (newPending.length > 0) {
          const allPending = [...existingPending, ...newPending]
          savePendingCases(allPending)
          console.log(
            `\nSaved ${newPending.length} new pending cases to ${PENDING_CASES_PATH}`
          )
        }

        // Report results
        console.log(`\nTested ${tested} random deals`)
        console.log(`Found ${mismatches} mismatches`)

        if (mismatches > 0) {
          console.log(
            `\nReview pending cases and migrate worthy ones to oracle7.json`
          )

          if (STRICT_MODE) {
            expect(mismatches).toBe(0)
          } else {
            console.log('(Run with STRICT_DIFF=1 to fail on mismatches)')
          }
        } else {
          console.log('✓ All random deals matched!')
        }
      } catch (err) {
        console.error('Test failed:', err)
        throw err
      }
    }
  )

  // Test specific known edge cases
  it.skipIf(!process.env.DIFF_ORACLE)(
    'should handle wheel straight correctly',
    () => {
      const wheelCards: Card[] = [
        { rank: 'A', suit: 's' },
        { rank: '5', suit: 'h' },
        { rank: '4', suit: 'd' },
        { rank: '3', suit: 'c' },
        { rank: '2', suit: 's' },
        { rank: 'K', suit: 'h' },
        { rank: 'Q', suit: 'd' },
      ]

      const ourResult = evaluateSeven(wheelCards)
      const ourNorm = normalizeOurEval(ourResult)

      const theirCards = wheelCards.map(toPokerEvaluatorCard)
      const theirResult = PokerEvaluator.evalHand(theirCards)
      const theirNorm = normalizeTheirEval(theirResult, wheelCards)

      expect(ourNorm.category).toBe('STRAIGHT')
      expect(theirNorm.category).toBe('STRAIGHT')
      expect(ourNorm.ranks[0]).toBe(5) // High card is 5 in wheel
      expect(evalsMatch(ourNorm, theirNorm)).toBe(true)
    }
  )

  it.skipIf(!process.env.DIFF_ORACLE)(
    'should handle board flush correctly',
    () => {
      // All players have same flush when board has 5 of same suit (not consecutive)
      const boardFlushCards: Card[] = [
        { rank: 'K', suit: 'h' },
        { rank: 'Q', suit: 'h' },
        { rank: 'J', suit: 'h' },
        { rank: '9', suit: 'h' },
        { rank: '7', suit: 'h' },
        { rank: '2', suit: 's' },
        { rank: '3', suit: 'd' },
      ]

      const ourResult = evaluateSeven(boardFlushCards)
      const ourNorm = normalizeOurEval(ourResult)

      const theirCards = boardFlushCards.map(toPokerEvaluatorCard)
      const theirResult = PokerEvaluator.evalHand(theirCards)
      const theirNorm = normalizeTheirEval(theirResult, boardFlushCards)

      expect(ourNorm.category).toBe('FLUSH')
      expect(theirNorm.category).toBe('FLUSH')
      expect(evalsMatch(ourNorm, theirNorm)).toBe(true)
    }
  )

  it.skipIf(!process.env.DIFF_ORACLE)(
    'should handle straight flush wheel correctly',
    () => {
      const wheelSFCards: Card[] = [
        { rank: 'A', suit: 'c' },
        { rank: '5', suit: 'c' },
        { rank: '4', suit: 'c' },
        { rank: '3', suit: 'c' },
        { rank: '2', suit: 'c' },
        { rank: 'K', suit: 'h' },
        { rank: 'Q', suit: 'd' },
      ]

      const ourResult = evaluateSeven(wheelSFCards)
      const ourNorm = normalizeOurEval(ourResult)

      const theirCards = wheelSFCards.map(toPokerEvaluatorCard)
      const theirResult = PokerEvaluator.evalHand(theirCards)
      const theirNorm = normalizeTheirEval(theirResult, wheelSFCards)

      expect(ourNorm.category).toBe('STRAIGHT_FLUSH')
      expect(theirNorm.category).toBe('STRAIGHT_FLUSH')
      expect(ourNorm.ranks[0]).toBe(5) // High card is 5 in wheel
      expect(evalsMatch(ourNorm, theirNorm)).toBe(true)
    }
  )
})
