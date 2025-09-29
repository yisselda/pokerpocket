// values
export { evaluateSeven as evaluate7 } from './evaluator.js'
export { newGame, PokerEngine, cardToAscii } from './engine.js'
export { drawRandom, createDeck, shuffle, draw } from './deck.js'
export * as betting from './betting.js'
export { RNG, LCG } from './rng.js'

// public types (type-only keeps treeshaking clean)
export type { Card, Rank, Suit, EvalResult, HandRank } from './types.js'

// New betting engine API
export { createTable } from './engine/state/createTable.js'
export { getLegalActions } from './engine/betting/legal.js'
export { reduce } from './engine/betting/reduce.js'
export { viewFor } from './engine/view.js'
export { selectors } from './engine/betting/selectors.js'

// New betting engine types
export type {
  Variant,
  Street,
  TableConfig,
  Rng,
  Seat,
  Pot,
  ActionEvent,
  TableState,
  Action,
  LegalActions,
} from './engine/betting/types.js'
