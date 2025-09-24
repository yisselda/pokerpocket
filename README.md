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
# Install latest beta
npm install pokerpocket

# Or install from GitHub
npm install github:yisselda/pokerpocket
```

## 🌐 [Try the Live Demo](https://yisselda.github.io/pokerpocket/)

Interactive web demo featuring:

- **Quick Game** - Play complete poker hands with multiple players
- **Hand Evaluator** - Test poker hands with manual card selection or random generation
- **Performance Benchmark** - Measure engine speed on your device

## CLI Usage

```bash
npx pokerpocket
```

The CLI features a full Texas Hold'em game with betting, chip stacks, blinds, and pot distribution.

### Typical Game Session

```
$ pokerpocket
🃏 Poker Pocket CLI
Type "help" for commands
Betting: ON | Blinds: 50/100 | Default stack: 10000

# 1. Setup game (optional)
> players 3
> blinds 25 50        # Set small/big blinds
> stacks 5000         # Set starting chip stacks
> seed 12345          # Set seed for reproducible games

# 2. Deal a hand - automatically posts blinds and starts pre-flop betting
> deal
Cards dealt! Blinds posted.
Players: 3, Phase: PREFLOP
💰 Pot: 75 | Current bet: 50
Players:
  P1: 4975 chips [25 in pot]    # Small blind
  P2 (D): 4950 chips [50 in pot] ← TO ACT    # Big blind, dealer button
  P3: 5000 chips

P3 actions: call, raise <amount> (100-5000), fold

# 3. Complete betting rounds
> call               # P3 calls the big blind
> call               # P1 calls (completes the bet)
> check              # P2 checks (already posted big blind)

# 4. Continue through streets
> flop               # Deal 3 community cards, start new betting round
Flop dealt!
Board: 7♦ K♠ 2♥
P1 actions: check, bet <amount> (50-4925)

> check              # All players check through
> check
> check

> turn               # Deal 4th community card
Turn dealt!
Board: 7♦ K♠ 2♥ A♣

# 5. More betting...
> bet 100            # P1 bets 100
> call               # P2 calls
> fold               # P3 folds

> river              # Deal 5th community card
River dealt!
Board: 7♦ K♠ 2♥ A♣ Q♠

> check              # Final betting round
> check

# 6. Showdown and pot distribution
> showdown

P1: T♣ J♠  ⇒  STRAIGHT (A♣,K♠,Q♠,J♠,T♣)
P2: 4♦ 9♦  ⇒  HIGH CARD (A♣,K♠,Q♠,9♦,7♦)
P3: K♥ A♠  ⇒  TWO PAIR (A♠,A♣,K♥,K♠,Q♠) (FOLDED)

Winner(s): P1

💰 Pot Distribution:
  P1 wins 350 chips

Final Stacks:
  P1: 5175 chips
  P2: 4750 chips
  P3: 4975 chips
```

### Quick Testing Session

For rapid testing, use `skipbet` to auto-complete betting rounds:

```
> deal
> skipbet             # Skip pre-flop betting (all players check/call)
> flop
> skipbet             # Skip flop betting
> turn
> skipbet             # Skip turn betting
> river
> skipbet             # Skip river betting
> showdown            # See results
```

## Engine API

Use the engine in your own projects:

```typescript
import { newGame, evaluate7, drawRandom } from 'pokerpocket'

// Quick game with helper function
const game = newGame({ players: 6, seed: 12345 })
game.deal()
game.flop()
game.turn()
game.river()

// Get results
const { results, winners } = game.showdown()
console.log(
  'Winners:',
  winners.map(w => `P${w + 1}`)
)

// Direct hand evaluation
const cards = [
  { rank: 'A', suit: 's' },
  { rank: 'K', suit: 's' },
  { rank: 'Q', suit: 's' },
  { rank: 'J', suit: 's' },
  { rank: 'T', suit: 's' },
  { rank: '2', suit: 'h' },
  { rank: '3', suit: 'h' },
]
const result = evaluate7(cards)
console.log(result.rank) // 'STRAIGHT_FLUSH'

// Random card generation
const randomHand = drawRandom(7) // Get 7 random cards
const handResult = evaluate7(randomHand)
console.log(`Random hand: ${handResult.rank}`)
```

## Commands

### Game Flow
- `deal` - Deal new hand, post blinds, start pre-flop betting
- `flop` - Deal flop (3 community cards), start new betting round
- `turn` - Deal turn (4th community card), start new betting round
- `river` - Deal river (5th community card), start new betting round
- `showdown` - Evaluate hands, determine winner(s), distribute pot

### Betting Actions
- `check` - Check (when no bet to call)
- `call` - Call the current bet
- `bet <amount>` - Bet specified amount (when no current bet)
- `raise <amount>` - Raise by specified amount
- `fold` - Fold your hand
- `allin` - Go all-in with remaining chips

### Game Setup
- `players <n>` - Set number of players (2-9, IDLE only)
- `blinds <sb> <bb>` - Set small and big blind amounts
- `ante <amount>` - Set ante amount (0 for none)
- `stacks <amount>` - Set default starting stack
- `button <player>` - Set dealer button position (0-based)
- `seed <n>` - Set RNG seed for reproducible games

### Utility
- `hole <player>` - Show hole cards for specific player (1-based)
- `status` - Show current game state
- `skipbet` - Auto-complete current betting round (testing)
- `help` - Show all commands
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
- **deck.ts** - 52-card deck with Fisher-Yates shuffle and random card utilities
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
