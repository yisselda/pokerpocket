import { describe, test, expect } from 'vitest'
import { createTable } from '../../../src/engine/state/createTable.js'
import { initHand } from '../../../src/engine/state/initHand.js'
import { processAction } from '../../../src/engine/betting/reduce.js'
import { TableState } from '../../../src/engine/betting/types.js'
import { createDeck } from '../../../src/deck.js'
import { advanceStreet, getNextActor } from '../../../src/engine/betting/order.js'

describe('Player Elimination', () => {
  test('players with 0 chips should not be dealt into new hands', () => {
    // Create table with 3 players
    let table = createTable({
      maxSeats: 6,
      players: [
        { id: 'p1', stack: 10 },  // Will lose all in blinds
        { id: 'p2', stack: 100 },
        { id: 'p3', stack: 100 },
      ],
      blinds: { sb: 5, bb: 10 },
      rng: createDeck(),
    })

    // Start first hand
    table = initHand(table)

    // Check if p1 has any chips left after blinds
    const p1AfterBlinds = table.seats.find(s => s.id === 'p1')

    // Simulate end of hand where P1 loses remaining chips
    table.seats = table.seats.map(seat => {
      if (seat.id === 'p1') {
        return { ...seat, stack: 0, hole: undefined, contributed: 0, streetContributed: 0, folded: false, allIn: false }
      }
      return { ...seat, hole: undefined, contributed: 0, streetContributed: 0, folded: false, allIn: false }
    })

    // Try to start a new hand
    const newHand = initHand(table)

    // Verify P1 (with 0 chips) was not dealt cards
    const p1NewSeat = newHand.seats.find(s => s.id === 'p1')
    expect(p1NewSeat).toBeDefined()
    expect(p1NewSeat!.stack).toBe(0)
    expect(p1NewSeat!.hole).toBeUndefined() // Should NOT have hole cards

    // Verify P2 and P3 were dealt cards
    const p2Seat = newHand.seats.find(s => s.id === 'p2')
    const p3Seat = newHand.seats.find(s => s.id === 'p3')
    expect(p2Seat!.hole).toBeDefined()
    expect(p3Seat!.hole).toBeDefined()
    expect(p2Seat!.hole!.length).toBe(2)
    expect(p3Seat!.hole!.length).toBe(2)
  })

  test('eliminated players should not be included in button/blind positions', () => {
    // Create table with 4 players
    let table = createTable({
      maxSeats: 6,
      players: [
        { id: 'p1', stack: 0 },   // Already eliminated
        { id: 'p2', stack: 100 },
        { id: 'p3', stack: 100 },
        { id: 'p4', stack: 100 },
      ],
      blinds: { sb: 5, bb: 10 },
      rng: createDeck(),
    })

    // Start hand - should skip p1 for button/blinds
    table = initHand(table)

    // Button should not be on p1 (seat 0)
    expect(table.button).not.toBe(0)

    // SB and BB should not be p1
    expect(table.sbIndex).not.toBe(0)
    expect(table.bbIndex).not.toBe(0)

    // Verify only active players have hole cards
    expect(table.seats[0].hole).toBeUndefined() // p1 eliminated
    expect(table.seats[1].hole).toBeDefined()    // p2 active
    expect(table.seats[2].hole).toBeDefined()    // p3 active
    expect(table.seats[3].hole).toBeDefined()    // p4 active
  })

  test('game should error when fewer than 2 players have chips', () => {
    // Create table with only 1 player with chips
    const table = createTable({
      maxSeats: 6,
      players: [
        { id: 'p1', stack: 0 },
        { id: 'p2', stack: 100 },
        { id: 'p3', stack: 0 },
      ],
      blinds: { sb: 5, bb: 10 },
      rng: createDeck(),
    })

    // Should throw error when trying to start hand
    expect(() => initHand(table)).toThrow('Need at least 2 players with chips to start hand')
  })

  test('getNextActor should skip eliminated players', () => {
    // Create a table with p2 eliminated but p1 and p3 active
    let table = createTable({
      maxSeats: 6,
      players: [
        { id: 'p1', stack: 100 },
        { id: 'p2', stack: 100 },    // Will be eliminated mid-hand
        { id: 'p3', stack: 100 },
      ],
      blinds: { sb: 5, bb: 10 },
      rng: createDeck(),
    })

    table = initHand(table)

    // Simulate p2 being eliminated during the hand
    table.seats[1].stack = 0
    table.seats[1].allIn = true

    // If action is on p1 (seat 0), next should be p3 (seat 2), skipping p2
    const nextAfterP1 = getNextActor(table, 0)
    expect(nextAfterP1).toBe(2) // Should skip seat 1 (p2 with 0 chips)
  })
})