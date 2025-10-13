# Poker Pocket

Texas Hold'em as a deterministic state machine. Create a table, feed in player moves, and render whatever UI you want.

## Install

```bash
npm install @pokerpocket/engine
npx pokerpocket           # uses the installed CLI
# or run once without installing
npx @pokerpocket/engine
npm run demo:dev   # launch the interactive demo (Vite)
```

## Run A Hand

```typescript
import {
  advanceUntilDecision,
  call,
  check,
  createTable,
  fold,
  getActionOptions,
  isBettingDecision,
  isHandDone,
  nextHand,
  raiseTo,
  reduce,
  toPresentation,
} from '@pokerpocket/engine'

let state = advanceUntilDecision(createTable(6, 20000, 100))

while (!isHandDone(state)) {
  if (!isBettingDecision(state)) {
    state = advanceUntilDecision(state)
    continue
  }

  const options = getActionOptions(state)
  if (!options) {
    state = advanceUntilDecision(state)
    continue
  }

  const action = options.canCheck
    ? check(options.seat)
    : options.canCall
      ? call(options.seat)
      : options.raise
        ? raiseTo(options.seat, options.raise.min)
        : fold(options.seat)

  state = advanceUntilDecision(reduce(state, action))
}

if (isHandDone(state)) {
  console.log(toPresentation(state))
  state = advanceUntilDecision(reduce(state, nextHand()))
}
```

## Core Concepts

```text
createTable -> advanceUntilDecision(state)
        |                     |
        |                     v
        |           +--------------------+
        |           | reduce(state, action)|
        |           +--------------------+
        |                     |
        v                     v
     +------+  START   +-----------+   DEAL_CARDS   +-----------+
     | INIT | -------> |   DEAL    | ------------> |  PREFLOP  |
     +------+          +-----------+               +-----------+
        ^                    |                           |
        |                    | shuffleDeck()             | player actions
        |                    v                           v
     NEXT_HAND         dealHole(), blinds        settle bets, advance actor
        |                    |                           |
        |                    v                           v
        |              +-----------+   ROUND_COMPLETE   +-----------+
        |              |   FLOP    | --------------->   |   TURN    |
        |              +-----------+                   +-----------+
        |                    | dealCommunity()              |
        |                    v                              v
        |              +-----------+   ROUND_COMPLETE   +-----------+
        |              |   RIVER   | --------------->   | SHOWDOWN  |
        |              +-----------+                   +-----------+
        |                    | resolveShowdown()             |
        |                    v                              v
        +--------------> +-----------+ <---------------------+
                          | COMPLETE |
                          +-----------+
```

The reducer loops until it reaches a player decision or terminal state. `advanceUntilDecision` fast-forwards through deterministic phases (posting blinds, dealing cards, burning/turning the board) so the host can wait for real player input before calling `reduce` again. When a hand ends, dispatch `nextHand()` to rotate the dealer and restart.

## Core Features

### Deterministic RNG (seed-in/seed-out)

- LCG RNG is included for speed and deterministic testing.
- For crypto-grade randomness, supply your own RNG wrapping a CSPRNG.
- For auditability/fairness, layer a commit–reveal scheme on top of the RNG contract.

```typescript
import {
  advanceUntilDecision,
  createTable,
  getSeed,
  toPresentation,
} from '@pokerpocket/engine'

const state = advanceUntilDecision(createTable(6, 20000, 100, { seed: 42 }))

console.log(toPresentation(state))
console.log(getSeed(state))
```

## Why Devs Like It

- Pure reducer; no timers, sockets, or RNG side effects
- Strong TypeScript types for every phase, pot, and action
- Side pots, heads-up blinds, and all-in fast-forward built in
- Easy to slot into React, Vue, bots, or your own loop

## API Reference

Typed signatures are derived directly from the TypeScript sources; the callouts underneath translate what each primitive does in plain language.

### Actions

```ts
startHand(): Action
dealCards(): Action
endRound(): Action
toShowdown(): Action
nextHand(): Action
fold(seat: SeatId): Action
check(seat: SeatId): Action
call(seat: SeatId): Action
raiseTo(seat: SeatId, amount: number): Action
```

- `startHand()` begins the hand by shuffling a fresh deck and moving from INIT to DEAL.
- `dealCards()` posts blinds, deals hole cards, and moves into PREFLOP.
- `endRound()` closes a betting street when everyone is settled.
- `toShowdown()` flips straight to the showdown phase when betting is over.
- `nextHand()` resets blinds and dealer positioning for the next hand.
- `fold`, `check`, `call`, and `raiseTo` generate player actions that `reduce` can consume; `raiseTo` specifies the final bet level rather than the raise increment.

### Selectors

```ts
getPhase(state: GameState): GameState['tag']
getPlayers(state: GameState): Player[]
getBoard(state: GameState): string[]
getBoardCards(state: GameState): Card[]
getBoardAscii(state: GameState): string
getPots(state: GameState): Pot[]
getPotSize(state: GameState): number
getCurrentPlayer(state: GameState): Player | null
getActingSeat(state: GameState): SeatId | null
isBettingPhase(state: GameState): state is Extract<GameState, { tag: BettingPhase }>
currentActorSeat(state: GameState): SeatId | null
getToCall(state: GameState, seat: SeatId): number
getLegalActions(state: GameState, seat: SeatId): LegalActions
isBettingDecision(state: GameState): boolean
isComplete(state: GameState): boolean
isHandDone(state: GameState): boolean
advanceUntilDecision(state: GameState): GameState
getPositions(state: GameState): PositionLabel[]
getActionOptions(state: GameState): ActionOptions | null

type PositionLabel = 'BTN' | 'SB' | 'BB' | ''
interface ActionOptions {
  seat: SeatId
  canFold: boolean
  canCheck: boolean
  canCall: boolean
  toCall: number
  raise?: { min: number; max?: number; unopened: boolean }
}
```

- `getPhase`, `getPlayers`, `getBoard`, and `getPots` expose raw reducer state without poking at union variants directly.
- `getBoardCards` and `getBoardAscii` hand back parsed or formatted community cards for display.
- `getCurrentPlayer`, `getActingSeat`, and `currentActorSeat` reveal whose turn it is (or `null` if no one can act).
- `isBettingPhase`, `isBettingDecision`, `isComplete`, and `isHandDone` express the game flow as readable predicates.
- `getToCall`, `getLegalActions`, and `getActionOptions` compute exactly what a seat can do, including raise bounds.
- `advanceUntilDecision` drives the deterministic state machine until a player must act or the hand ends.
- `getPositions` returns BTN/SB/BB markers aligned with `getPlayers` output.

### Utilities

```ts
interface CreateTableOptions { rng?: RNG; seed?: number }
createTable(nbPlayers: number, chips: number, bigBlind: number, opts?: CreateTableOptions): GameState
reduce(state: GameState, action: Action): GameState
toPresentation(state: GameState): PresentationView

interface PresentationRowOdds {
  method: 'settled' | 'exact' | 'monteCarlo'
  equity: number
  winProbability: number
  tieProbability: number
  trials: number
  considered: boolean
}

interface PresentationRow {
  marker: string
  line: string
  odds?: PresentationRowOdds
}
interface PresentationView {
  header: string
  board?: string
  pot?: number
  rows: PresentationRow[]
  footer?: string
}
```

- `createTable` bootstraps a seeded table with identical stacks and an optional custom RNG.
- `reduce` is the pure state machine that applies actions, whether automated or player-driven.
- `toPresentation` converts the current state into a lightweight, printable view useful for CLIs or logs.

### RNG

```ts
interface RNG {
  next(): number
  getState(): number
  setState(state: number): void
  randInt?(n: number): number
}

class LcgRng implements RNG {
  constructor(seed?: number)
  next(): number
  getState(): number
  setState(state: number): void
  randInt(n: number): number
  static fromState(state: number): LcgRng
}

withSeed(seed: number): RNG
ensureRng(rng: RNG | undefined, seed: number | undefined): RNG
serializeRng(state: { rng?: RNG }): number | undefined
getSeed(state: { rng?: RNG }): number | undefined
```

- `RNG` specifies the interface the engine expects; any compliant generator can be plugged in.
- `LcgRng` is the built-in fast linear congruential generator, offering deterministic sequences and state serialization.
- `withSeed` and `ensureRng` help wire a seed or external RNG into `createTable` without branching logic.
- `serializeRng` and `getSeed` snapshot the internal RNG state for logging, replay, or fairness audits.

## Development

```bash
npm install
npm test
npm run build
npm run demo:dev   # launch the Vite playground
```

MIT License.

## Benchmarks

Run the Vitest benchmark suite to sample hot paths in the engine:

```bash
npm run bench -- --outputJson bench-results.json
```

CI compares every run with `benchmarks/baseline.json` and fails if a benchmark slows by more than 5%. The current baseline (Node.js 20, macOS) records roughly:

- `shuffleDeck with LCG`: ~1.37M ops/sec (≈0.73µs per shuffle)
- `evaluateSevenCards canonical hand`: ~6.46M ops/sec (≈0.15µs per eval)
- `play deterministic hand (6 players)`: ~70K ops/sec (≈14µs per full hand)

Use `bench-results.json` emitted by the command above to inspect the full distribution when tuning the engine.
