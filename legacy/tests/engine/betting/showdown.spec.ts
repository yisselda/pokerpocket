import { describe, it, expect } from 'vitest'
import { createTable, reduce } from '../../../src/index.js'
import { TableConfig, TableState } from '../../../src/engine/betting/types.js'
import { processShowdown } from '../../../src/engine/betting/showdown.js'
import { Card } from '../../../src/types.js'

describe('Showdown and payouts', () => {
  it('should award pot to single winner (heads-up)', () => {
    // Create a simple state with predetermined cards
    const state: TableState = {
      config: {
        variant: 'NLHE',
        maxSeats: 2,
        blinds: { sb: 50, bb: 100 },
        oddChipRule: 'LEFT_OF_BUTTON',
      } as TableConfig,
      handId: 1,
      street: 'RIVER',
      board: [
        { rank: 'A', suit: 'spades' },
        { rank: 'K', suit: 'spades' },
        { rank: 'Q', suit: 'spades' },
        { rank: 'J', suit: 'spades' },
        { rank: '2', suit: 'hearts' },
      ] as Card[],
      seats: [
        {
          id: 'p1',
          stack: 900,
          hole: [
            { rank: 'T', suit: 'spades' },  // Royal flush
            { rank: '9', suit: 'spades' },
          ] as [Card, Card],
          contributed: 100,
          streetContributed: 0,
          folded: false,
          allIn: false,
        },
        {
          id: 'p2',
          stack: 900,
          hole: [
            { rank: '2', suit: 'clubs' },   // Pair of twos
            { rank: '3', suit: 'clubs' },
          ] as [Card, Card],
          contributed: 100,
          streetContributed: 0,
          folded: false,
          allIn: false,
        },
      ],
      pots: [{ amount: 200, eligible: ['p1', 'p2'] }],
      button: 0,
      sbIndex: 0,
      bbIndex: 1,
      actionOn: 0,
      currentBet: 0,
      lastRaiseSize: 0,
      bettingReopened: false,
      hasActedThisRound: new Set(),
      history: [],
    }

    const result = processShowdown(state)

    expect(result.street).toBe('COMPLETE')
    expect(result.winners).toHaveLength(1)
    expect(result.winners![0].seatId).toBe('p1')
    expect(result.winners![0].amount).toBe(200)
    expect(result.seats[0].stack).toBe(1100)  // 900 + 200 won
    expect(result.seats[1].stack).toBe(900)   // No change
  })

  it('should split pot between tied winners (heads-up)', () => {
    const state: TableState = {
      config: {
        variant: 'NLHE',
        maxSeats: 2,
        blinds: { sb: 50, bb: 100 },
        oddChipRule: 'LEFT_OF_BUTTON',
      } as TableConfig,
      handId: 1,
      street: 'RIVER',
      board: [
        { rank: 'A', suit: 'spades' },
        { rank: 'A', suit: 'hearts' },
        { rank: 'K', suit: 'spades' },
        { rank: 'K', suit: 'hearts' },
        { rank: 'Q', suit: 'spades' },
      ] as Card[],
      seats: [
        {
          id: 'p1',
          stack: 900,
          hole: [
            { rank: '2', suit: 'clubs' },   // Two pair AA KK Q kicker
            { rank: '3', suit: 'clubs' },
          ] as [Card, Card],
          contributed: 100,
          streetContributed: 0,
          folded: false,
          allIn: false,
        },
        {
          id: 'p2',
          stack: 900,
          hole: [
            { rank: '4', suit: 'diamonds' }, // Same two pair AA KK Q kicker
            { rank: '5', suit: 'diamonds' },
          ] as [Card, Card],
          contributed: 100,
          streetContributed: 0,
          folded: false,
          allIn: false,
        },
      ],
      pots: [{ amount: 200, eligible: ['p1', 'p2'] }],
      button: 0,
      sbIndex: 0,
      bbIndex: 1,
      actionOn: 0,
      currentBet: 0,
      lastRaiseSize: 0,
      bettingReopened: false,
      hasActedThisRound: new Set(),
      history: [],
    }

    const result = processShowdown(state)

    expect(result.winners).toHaveLength(2)
    expect(result.seats[0].stack).toBe(1000)  // 900 + 100 (half pot)
    expect(result.seats[1].stack).toBe(1000)  // 900 + 100 (half pot)
  })

  it('should handle odd chips correctly (3-handed)', () => {
    const state: TableState = {
      config: {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        oddChipRule: 'LEFT_OF_BUTTON',
      } as TableConfig,
      handId: 1,
      street: 'RIVER',
      board: [
        { rank: 'A', suit: 'spades' },
        { rank: 'K', suit: 'spades' },
        { rank: 'Q', suit: 'spades' },
        { rank: 'J', suit: 'spades' },
        { rank: 'T', suit: 'spades' },
      ] as Card[],
      seats: [
        {
          id: 'p1',
          stack: 900,
          hole: [
            { rank: '2', suit: 'clubs' },   // Straight flush on board
            { rank: '3', suit: 'clubs' },
          ] as [Card, Card],
          contributed: 101,
          streetContributed: 0,
          folded: false,
          allIn: false,
        },
        {
          id: 'p2',
          stack: 900,
          hole: [
            { rank: '4', suit: 'diamonds' }, // Same straight flush on board
            { rank: '5', suit: 'diamonds' },
          ] as [Card, Card],
          contributed: 101,
          streetContributed: 0,
          folded: false,
          allIn: false,
        },
        {
          id: 'p3',
          stack: 900,
          hole: [
            { rank: '6', suit: 'hearts' },   // Same straight flush on board
            { rank: '7', suit: 'hearts' },
          ] as [Card, Card],
          contributed: 101,
          streetContributed: 0,
          folded: false,
          allIn: false,
        },
      ],
      pots: [{ amount: 303, eligible: ['p1', 'p2', 'p3'] }],  // 303 / 3 = 101
      button: 0,  // Button at seat 0
      sbIndex: 1,
      bbIndex: 2,
      actionOn: 0,
      currentBet: 0,
      lastRaiseSize: 0,
      bettingReopened: false,
      hasActedThisRound: new Set(),
      history: [],
    }

    const result = processShowdown(state)

    expect(result.winners).toHaveLength(3)
    // 303 / 3 = 101 each
    // But we're splitting 303, so each gets 101
    expect(result.seats[0].stack).toBe(1001)  // Gets base amount
    expect(result.seats[1].stack).toBe(1001)  // First left of button
    expect(result.seats[2].stack).toBe(1001)  // Second left of button
  })

  it('should handle multiple side pots correctly (3-handed)', () => {
    const state: TableState = {
      config: {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        oddChipRule: 'LEFT_OF_BUTTON',
      } as TableConfig,
      handId: 1,
      street: 'RIVER',
      board: [
        { rank: 'A', suit: 'spades' },
        { rank: 'K', suit: 'hearts' },
        { rank: '7', suit: 'clubs' },
        { rank: '3', suit: 'diamonds' },
        { rank: '2', suit: 'spades' },
      ] as Card[],
      seats: [
        {
          id: 'p1',
          stack: 0,
          hole: [
            { rank: '7', suit: 'hearts' },   // Pair of 7s
            { rank: '8', suit: 'hearts' },
          ] as [Card, Card],
          contributed: 100,
          streetContributed: 0,
          folded: false,
          allIn: true,
        },
        {
          id: 'p2',
          stack: 0,
          hole: [
            { rank: 'A', suit: 'clubs' },   // Pair of Aces (best)
            { rank: 'Q', suit: 'clubs' },
          ] as [Card, Card],
          contributed: 200,
          streetContributed: 0,
          folded: false,
          allIn: true,
        },
        {
          id: 'p3',
          stack: 100,
          hole: [
            { rank: '5', suit: 'diamonds' }, // High card only
            { rank: '4', suit: 'diamonds' },
          ] as [Card, Card],
          contributed: 300,
          streetContributed: 0,
          folded: false,
          allIn: false,
        },
      ],
      pots: [
        { amount: 300, eligible: ['p1', 'p2', 'p3'] },  // Main pot
        { amount: 200, eligible: ['p2', 'p3'] },        // Side pot 1
        { amount: 100, eligible: ['p3'] },              // Side pot 2
      ],
      button: 0,
      sbIndex: 1,
      bbIndex: 2,
      actionOn: 0,
      currentBet: 0,
      lastRaiseSize: 0,
      bettingReopened: false,
      hasActedThisRound: new Set(),
      history: [],
    }

    const result = processShowdown(state)

    expect(result.winners).toHaveLength(2)

    // p2 wins main pot (300) and side pot 1 (200) = 500
    const p2Winner = result.winners!.find(w => w.seatId === 'p2')
    expect(p2Winner?.amount).toBe(500)

    // p3 wins side pot 2 (100)
    const p3Winner = result.winners!.find(w => w.seatId === 'p3')
    expect(p3Winner?.amount).toBe(100)

    // Final stacks
    expect(result.seats[0].stack).toBe(0)    // p1 lost
    expect(result.seats[1].stack).toBe(500)  // p2 won 500
    expect(result.seats[2].stack).toBe(200)  // p3 had 100 + won 100
  })

  it('should handle folded players (heads-up)', () => {
    const state: TableState = {
      config: {
        variant: 'NLHE',
        maxSeats: 2,
        blinds: { sb: 50, bb: 100 },
        oddChipRule: 'LEFT_OF_BUTTON',
      } as TableConfig,
      handId: 1,
      street: 'RIVER',
      board: [
        { rank: 'A', suit: 'spades' },
        { rank: 'K', suit: 'hearts' },
        { rank: 'Q', suit: 'clubs' },
        { rank: 'J', suit: 'diamonds' },
        { rank: 'T', suit: 'spades' },
      ] as Card[],
      seats: [
        {
          id: 'p1',
          stack: 900,
          hole: [
            { rank: '2', suit: 'clubs' },
            { rank: '3', suit: 'clubs' },
          ] as [Card, Card],
          contributed: 100,
          streetContributed: 0,
          folded: true,  // Folded
          allIn: false,
        },
        {
          id: 'p2',
          stack: 900,
          hole: [
            { rank: '4', suit: 'diamonds' },
            { rank: '5', suit: 'diamonds' },
          ] as [Card, Card],
          contributed: 100,
          streetContributed: 0,
          folded: false,
          allIn: false,
        },
      ],
      pots: [{ amount: 200, eligible: ['p2'] }],  // Only p2 eligible
      button: 0,
      sbIndex: 0,
      bbIndex: 1,
      actionOn: 0,
      currentBet: 0,
      lastRaiseSize: 0,
      bettingReopened: false,
      hasActedThisRound: new Set(),
      history: [],
    }

    const result = processShowdown(state)

    expect(result.winners).toHaveLength(1)
    expect(result.winners![0].seatId).toBe('p2')
    expect(result.winners![0].amount).toBe(200)
    expect(result.seats[0].stack).toBe(900)   // p1 folded, no change
    expect(result.seats[1].stack).toBe(1100)  // p2 wins pot
  })
})