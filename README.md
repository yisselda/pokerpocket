# Poker Pocket

Zero-dependency Texas Hold'em engine for JavaScript/TypeScript. Node.js >= 16.

## Installation

```bash
npm install pokerpocket           # Library
npm install -g pokerpocket        # CLI
```

## Quick Start

```typescript
import { newGame, evaluate7, drawRandom } from 'pokerpocket'

// Run a complete game
const game = newGame({ players: 6, seed: 12345 })
game.deal()
game.flop()
game.turn()
game.river()
const { winners } = game.showdown()

// Evaluate hands directly
const cards = [
  { rank: 'A', suit: 's' },
  { rank: 'K', suit: 's' },
  // ... 5 more cards
]
const result = evaluate7(cards)
console.log(result.rank) // 'STRAIGHT_FLUSH'

// Generate random hands
const hand = drawRandom(7)
```

## CLI

```bash
pokerpocket                       # Interactive game
npx pokerpocket                   # Without installing
```

The CLI provides a full Texas Hold'em experience with betting, blinds, and chip management.

### Key Commands

**Game Flow:** `deal`, `flop`, `turn`, `river`, `showdown`
**Betting:** `bet <amount>`, `call`, `check`, `fold`, `allin`
**Setup:** `players <n>`, `blinds <sb> <bb>`, `stacks <amount>`
**Utility:** `help`, `status`, `hole <player>`

Quick test session:

```
> deal
> skipbet  # Auto-complete betting
> flop
> skipbet
> turn
> skipbet
> river
> skipbet
> showdown
```

## API Reference

### Game Engine

```typescript
import { newGame, PokerEngine } from 'pokerpocket'

// Helper function
const game = newGame({ players: 4, seed: 42 })

// Or direct engine usage
const engine = new PokerEngine()
engine.setPlayers(4)
engine.setSeed(42)
engine.deal()
```

### Hand Evaluation

```typescript
import { evaluate7, evaluate5 } from 'pokerpocket'

// Best 5 from 7 cards
const result7 = evaluate7(sevenCards)

// Evaluate exactly 5 cards
const result5 = evaluate5(fiveCards)

// Result contains:
// - rank: 'STRAIGHT_FLUSH' | 'FOUR_OF_A_KIND' | etc
// - score: BigInt for comparison
// - best5: Array of 5 cards used
```

### Utilities

```typescript
import { drawRandom, createDeck, shuffle } from 'pokerpocket'

// Random cards
const hand = drawRandom(2) // 2 hole cards
const board = drawRandom(5) // 5 community cards

// Deck operations
let deck = createDeck()
deck = shuffle(deck, seed)
```

## Development

```bash
npm install
npm test
npm run build
```

## Demo

Try the [live demo](https://yisselda.github.io/pokerpocket/) with interactive hand evaluation and benchmarking.

## License

MIT

## Contributing

Issues and PRs welcome on [GitHub](https://github.com/yisselda/pokerpocket).
