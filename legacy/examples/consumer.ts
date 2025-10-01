// Type smoke test to verify imports work correctly (built package)
import { evaluate7 } from 'pokerpocket'
import type { Card, Rank, Suit, EvalResult, HandRank } from 'pokerpocket'

const card: Card = { rank: 'A', suit: 's' }
const rank: Rank = 'K'
const suit: Suit = 'h'

const testCards: Card[] = [
  { rank: 'A', suit: 's' },
  { rank: 'K', suit: 's' },
  { rank: 'Q', suit: 's' },
  { rank: 'J', suit: 's' },
  { rank: 'T', suit: 's' },
  { rank: '9', suit: 's' },
  { rank: '8', suit: 's' },
]

const result: EvalResult = evaluate7(testCards)

// Verify types are correct
const handRank: HandRank = result.rank
const tiebreak: number[] = result.tiebreak
const score: bigint = result.score
const best5: Card[] = result.best5

console.log('Type smoke test passed!')
