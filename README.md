# Poker Pocket

Texas Hold'em as a deterministic state machine. Create a table, feed in player moves, and render whatever UI you want.

## Install

```bash
npm install @pokerpocket/engine
npx pokerpocket           # uses the installed CLI
# or run once without installing
npx @pokerpocket/engine
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
  while (next.tag === 'INIT' || next.tag === 'DEAL' || next.tag === 'SHOWDOWN') {
    const auto = next.tag === 'INIT'
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
```

MIT License.
