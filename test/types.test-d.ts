import { expectType } from 'tsd'
import {
  newGame,
  evaluate7,
  PokerEngine,
  GameOptions,
  ShowdownResult,
} from 'pokerpocket'
import { Card, EvalResult } from 'pokerpocket/types'

// Test newGame function
const game = newGame({ players: 2 })
expectType<PokerEngine>(game)

// Test players property access through status
const status = game.status()
expectType<number>(status.players)

// Test GameOptions interface
const options: GameOptions = { players: 5, seed: 42 }
expectType<GameOptions>(options)

// Optional properties work
const minimalOptions: GameOptions = {}
expectType<GameOptions>(minimalOptions)

// Test evaluate7 function export
const testCard: Card = { rank: 'A', suit: 's' }
expectType<Card>(testCard)

const cards: Card[] = [
  { rank: 'A', suit: 's' },
  { rank: 'K', suit: 'h' },
  { rank: 'Q', suit: 'd' },
  { rank: 'J', suit: 'c' },
  { rank: 'T', suit: 's' },
]

const evaluation = evaluate7(cards)
expectType<EvalResult>(evaluation)
expectType<bigint>(evaluation.score)
expectType<Card[]>(evaluation.best5)

// Test showdown result types
game.setPlayers(2)
game.setSeed(1)
game.deal()
game.flop()
game.turn()
game.river()
const result = game.showdown()
expectType<ShowdownResult>(result)
expectType<number[]>(result.winners)

// Ensure CLI types don't leak into public API
// These should not be available when importing from the main export
// Note: We can't directly test for CLI absence, but we can ensure
// only expected types are available through the public API

// Test that engine methods return expected types
expectType<void>(game.deal())
expectType<void>(game.flop())
expectType<void>(game.turn())
expectType<void>(game.river())

// Test method chaining capability (void returns mean no chaining)
expectType<void>(newGame().setPlayers(3))
expectType<void>(newGame().setSeed(123))
