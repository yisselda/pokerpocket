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
