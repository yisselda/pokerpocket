# Poker Pocket

A lightweight, dependency-free Texas Hold'em CLI with a clean, embeddable engine.

## Features

- ✅ **Zero runtime dependencies** - Pure TypeScript/JavaScript implementation
- ✅ **Deterministic evaluation** - Seedable RNG for reproducible games
- ✅ **Correct hand evaluation** - 7→best-5 card evaluation with proper tie-breaking
- ✅ **Fast performance** - <50ms showdown for 9 players
- ✅ **ESM-only** - Modern module system, Node.js >= 20
- ✅ **Embeddable engine** - Use in React Native, web, or other projects
- ✅ **Unicode card display** - Beautiful card symbols with ASCII fallback
- ✅ **Comprehensive tests** - Full test coverage with Vitest

## Installation

```bash
npm install poker-pocket
```

## CLI Usage

```bash
npx pocket
```

### Example Session

```
$ pocket
🃏 Poker Pocket CLI
Type "help" for commands
Players: 2, Phase: IDLE
Available: deal, players <n>, seed <n>

> players 3
Players set to 3
Players: 3, Phase: IDLE
Available: deal, players <n>, seed <n>

> seed 12345
Seed set to 12345 for next deal
Players: 3, Phase: IDLE
Next seed: 12345
Available: deal, players <n>, seed <n>

> deal
Cards dealt!
Players: 3, Phase: PREFLOP
Hole: P1: 2 cards, P2: 2 cards, P3: 2 cards
Available: flop

> flop
Flop dealt!
Players: 3, Phase: FLOP
Board: 7♦ K♠ 2♥
Hole: P1: 2 cards, P2: 2 cards, P3: 2 cards
Available: turn, showdown

> turn
Turn dealt!
Players: 3, Phase: TURN
Board: 7♦ K♠ 2♥ A♣
Hole: P1: 2 cards, P2: 2 cards, P3: 2 cards
Available: river, showdown

> river
River dealt!
Players: 3, Phase: RIVER
Board: 7♦ K♠ 2♥ A♣ Q♠
Hole: P1: 2 cards, P2: 2 cards, P3: 2 cards
Available: showdown

> showdown

P1: T♣ J♠  ⇒  STRAIGHT (A♣,K♠,Q♠,J♠,T♣)
P2: 4♦ 9♦  ⇒  HIGH CARD (A♣,K♠,Q♠,9♦,7♦)
P3: K♥ A♠  ⇒  TWO PAIR (A♠,A♣,K♥,K♠,Q♠)

Winner(s): P1
```

## Engine API

Use the engine in your own projects:

```typescript
import { PokerEngine } from 'poker-pocket/engine'
import { evaluateSeven } from 'poker-pocket/evaluator'

// Create engine
const engine = new PokerEngine()

// Set up game
engine.setPlayers(6)
engine.setSeed(12345)

// Play hand
engine.deal()
engine.flop()
engine.turn()
engine.river()

// Get results
const { results, winners } = engine.showdown()
console.log('Winners:', winners.map(w => `P${w + 1}`))

// Direct evaluation
const cards = [
  { rank: 'A', suit: 's' }, { rank: 'K', suit: 's' },
  { rank: 'Q', suit: 's' }, { rank: 'J', suit: 's' },
  { rank: 'T', suit: 's' }, { rank: '2', suit: 'h' },
  { rank: '3', suit: 'h' }
]
const result = evaluateSeven(cards)
console.log(result.rank) // 'STRAIGHT_FLUSH'
```

## Commands

- `deal` - Deal new hand (2 cards per player)
- `flop` - Deal flop (3 community cards)
- `turn` - Deal turn (4th community card)
- `river` - Deal river (5th community card)
- `showdown` - Evaluate hands and determine winner(s)
- `players <n>` - Set number of players (2-9, IDLE only)
- `seed <n>` - Set RNG seed for next deal
- `status` - Show current game state
- `help` - Show help
- `q` - Quit

## Hand Rankings

1. **Straight Flush** - Five cards in sequence, same suit
2. **Four of a Kind** - Four cards of same rank
3. **Full House** - Three of a kind + pair
4. **Flush** - Five cards same suit
5. **Straight** - Five cards in sequence
6. **Three of a Kind** - Three cards of same rank
7. **Two Pair** - Two pairs
8. **One Pair** - One pair
9. **High Card** - No other hand

### Special Cases

- **Royal Flush**: A♠ K♠ Q♠ J♠ T♠ (straight flush ace-high)
- **Steel Wheel**: 5♠ 4♠ 3♠ 2♠ A♠ (straight flush five-high)
- **Wheel**: A-2-3-4-5 (straight with ace low)

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Development CLI
npm run dev
```

## Architecture

### Core Components

- **types.ts** - Type definitions for cards, hands, and results
- **rng.ts** - Seedable Linear Congruential Generator
- **deck.ts** - 52-card deck with Fisher-Yates shuffle
- **evaluator.ts** - 7→best-5 hand evaluation with tie-breaking
- **engine.ts** - Game state management and flow control
- **cli.ts** - Interactive command-line interface

### Hand Evaluation

The evaluator uses a brute-force approach, checking all 21 possible 5-card combinations from 7 cards and selecting the best. Each hand gets a BigInt score for deterministic comparison:

```
score = (rank_code << 40) | (tie1 << 32) | (tie2 << 24) | (tie3 << 16) | (tie4 << 8) | tie5
```

This ensures proper ordering with no ambiguity in tie-breaking.

## License

MIT

## Contributing

Issues and pull requests welcome on [GitHub](https://github.com/anthropics/poker-pocket).