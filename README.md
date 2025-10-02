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
  createTable,
  reduce,
  startHand,
  dealCards,
  toShowdown,
  nextHand,
  check,
  call,
  fold,
  raiseTo,
  getCurrentPlayer,
  getLegalActions,
} from '@pokerpocket/engine'

const step = (state, action) => {
  let next = reduce(state, action)
  while (
    next.tag === 'INIT' ||
    next.tag === 'DEAL' ||
    next.tag === 'SHOWDOWN'
  ) {
    const auto =
      next.tag === 'INIT'
        ? startHand()
        : next.tag === 'DEAL'
          ? dealCards()
          : toShowdown()
    next = reduce(next, auto)
  }
  return next
}

let state = step(createTable(6, 20000, 100), startHand())

while (state.tag !== 'COMPLETE') {
  const actor = getCurrentPlayer(state)
  if (!actor) break
  const legal = getLegalActions(state, actor.id)
  const action = legal.canCheck
    ? check(actor.id)
    : legal.canCall
      ? call(actor.id)
      : typeof legal.minRaise === 'number'
        ? raiseTo(actor.id, legal.minRaise)
        : fold(actor.id)
  state = step(state, action)
}

if (state.tag === 'COMPLETE') {
  console.log(state.winners)
  state = step(state, nextHand())
}
```

## Core Features

### Deterministic RNG (seed-in/seed-out)

- LCG RNG is included for speed and deterministic testing.
- For crypto-grade randomness, supply your own RNG wrapping a CSPRNG.
- For auditability/fairness, layer a commit–reveal scheme on top of the RNG contract.

```typescript
import {
  createTable,
  reduce,
  startHand,
  dealCards,
  getBoard,
  serializeRng,
} from '@pokerpocket/engine'

let state = createTable(6, 20000, 100, { seed: 42 })
state = reduce(state, startHand())
state = reduce(state, dealCards())

console.log(getBoard(state))
console.log(serializeRng(state))
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
