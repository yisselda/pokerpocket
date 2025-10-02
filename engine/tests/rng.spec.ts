import { describe, it, expect } from 'vitest'
import { createTable } from '../src/init'
import { reduce } from '../src/reducer'
import { shuffleDeck } from '../src/deck'
import { serializeRng, withSeed } from '../src/rng'
import { startHand, dealCards } from '../src/actions'
import { expectState } from './helpers/state'

describe('deterministic rng', () => {
  it('produces identical shuffles for the same seed', () => {
    const tableA = createTable(3, 1000, 100, { seed: 123 })
    const tableB = createTable(3, 1000, 100, { seed: 123 })

    const dealtA = reduce(reduce(tableA, startHand()), dealCards())
    const dealtB = reduce(reduce(tableB, startHand()), dealCards())

    const preflopA = expectState(dealtA, 'PREFLOP')
    const preflopB = expectState(dealtB, 'PREFLOP')
    expect(preflopA.deck).toEqual(preflopB.deck)
    expect(dealtA.players.map(p => p.hole)).toEqual(
      dealtB.players.map(p => p.hole)
    )
  })

  it('serializes and restores the rng stream', () => {
    const table = createTable(2, 1000, 100, { seed: 7 })
    const started = reduce(table, startHand())

    const serialized = serializeRng(started)
    expect(serialized).toBeTypeOf('number')
    if (serialized === undefined) throw new Error('rng missing')

    const continuedDeck = shuffleDeck(started.rng)

    const restored = createTable(2, 1000, 100, { rng: withSeed(serialized) })
    const restoredDeck = shuffleDeck(restored.rng)

    expect(restoredDeck).toEqual(continuedDeck)
  })
})
