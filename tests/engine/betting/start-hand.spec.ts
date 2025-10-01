import { describe, it, expect } from 'vitest'
import {
  createTable,
  reduce,
  type TableConfig,
  type TableState,
  type Action,
} from '../../../src/index.js'
import { makeRiggedRng, cards } from '../../_utils/helpers.js'

describe('START_HAND', () => {
  it('should create an empty table with correct initial state (3-handed)', () => {
    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 3,
      blinds: { sb: 50, bb: 100 },
    }

    const table = createTable(config)

    expect(table.handId).toBe(0)
    expect(table.seats.length).toBe(3)
    expect(table.street).toBe('PREFLOP')
    expect(table.board).toEqual([])
    expect(table.pots).toEqual([])
    expect(table.currentBet).toBe(0)
    expect(table.lastRaiseSize).toBe(0)
    expect(table.button).toBe(0)
    expect(table.history).toEqual([])
  })

  it('should seat players and start a hand with antes and blinds (3-handed)', () => {
    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 3,
      blinds: { sb: 50, bb: 100 },
      ante: 10,
      seed: 12345,
    }

    let table = createTable(config)

    // Seat 3 players
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000, name: 'Alice' })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 1500, name: 'Bob' })
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 2000, name: 'Charlie' })

    // Start hand
    table = reduce(table, { type: 'START_HAND' })

    // Check handId incremented
    expect(table.handId).toBe(1)

    // Check street
    expect(table.street).toBe('PREFLOP')

    // Check blinds positions (button at 0, SB at 1, BB at 2)
    expect(table.button).toBe(0)
    expect(table.sbIndex).toBe(1)
    expect(table.bbIndex).toBe(2)

    // Check antes posted (10 each) and blinds
    expect(table.seats[0].contributed).toBe(10) // ante only (button)
    expect(table.seats[1].contributed).toBe(10 + 50) // ante + SB
    expect(table.seats[2].contributed).toBe(10 + 100) // ante + BB

    // Check stacks reduced
    expect(table.seats[0].stack).toBe(1000 - 10) // 1000 - 10 ante
    expect(table.seats[1].stack).toBe(1500 - 60) // 1500 - (10 ante + 50 SB)
    expect(table.seats[2].stack).toBe(2000 - 110) // 2000 - (10 ante + 100 BB)

    // Check betting state
    expect(table.currentBet).toBe(100)
    expect(table.lastRaiseSize).toBe(100)

    // Check action is on UTG (seat 0, left of BB)
    expect(table.actionOn).toBe(0)

    // Check cards dealt (2 per player)
    expect(table.seats[0].hole).toHaveLength(2)
    expect(table.seats[1].hole).toHaveLength(2)
    expect(table.seats[2].hole).toHaveLength(2)
  })

  it('should handle heads-up blind posting correctly', () => {
    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 2,
      blinds: { sb: 25, bb: 50 },
      seed: 42,
    }

    let table = createTable(config)

    // Seat 2 players for heads-up
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000, name: 'Alice' })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000, name: 'Bob' })

    // Start hand
    table = reduce(table, { type: 'START_HAND' })

    // In heads-up: button posts SB, other posts BB
    expect(table.button).toBe(0)
    expect(table.sbIndex).toBe(0) // Button is SB
    expect(table.bbIndex).toBe(1)

    // Check blinds posted correctly
    expect(table.seats[0].contributed).toBe(25) // SB
    expect(table.seats[1].contributed).toBe(50) // BB
    expect(table.seats[0].stack).toBe(975)
    expect(table.seats[1].stack).toBe(950)

    // Heads-up preflop: SB/button acts first (seat 0)
    expect(table.actionOn).toBe(0)

    // Check betting state
    expect(table.currentBet).toBe(50)
    expect(table.lastRaiseSize).toBe(50)
  })

  it('should handle short stack all-in blind posting (3-handed)', () => {
    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 3,
      blinds: { sb: 50, bb: 100 },
      seed: 999,
    }

    let table = createTable(config)

    // Seat players with short stacks
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 30, name: 'ShortStack' }) // Less than SB
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 75, name: 'MidStack' }) // Between SB and BB
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000, name: 'BigStack' })

    // Start hand
    table = reduce(table, { type: 'START_HAND' })

    // Button at 0, SB at 1, BB at 2
    expect(table.sbIndex).toBe(1)
    expect(table.bbIndex).toBe(2)

    // Short stack posts all they have as SB
    expect(table.seats[1].contributed).toBe(50) // Can post full SB
    expect(table.seats[1].stack).toBe(25) // 75 - 50
    expect(table.seats[1].allIn).toBe(false)

    // BB posts normally
    expect(table.seats[2].contributed).toBe(100)
    expect(table.seats[2].stack).toBe(900)

    // currentBet should be 100 (the BB)
    expect(table.currentBet).toBe(100)
  })

  it('should handle all-in on blind posting', () => {
    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 3,
      blinds: { sb: 50, bb: 100 },
      seed: 111,
    }

    let table = createTable(config)

    // Seat players
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000, name: 'Normal' })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 40, name: 'TinyStack' }) // Less than SB
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 80, name: 'SmallStack' }) // Less than BB

    // Start hand
    table = reduce(table, { type: 'START_HAND' })

    // SB posts all 40 and goes all-in
    expect(table.seats[1].contributed).toBe(40)
    expect(table.seats[1].stack).toBe(0)
    expect(table.seats[1].allIn).toBe(true)

    // BB posts all 80 and goes all-in
    expect(table.seats[2].contributed).toBe(80)
    expect(table.seats[2].stack).toBe(0)
    expect(table.seats[2].allIn).toBe(true)

    // currentBet should be 80 (highest contribution)
    expect(table.currentBet).toBe(80)

    // Action on seat 0 (only non-all-in player)
    expect(table.actionOn).toBe(0)
  })

  it('should use injected RNG for deterministic dealing', () => {
    const riggedCards = cards(
      // Player 0 hole cards
      'As', 'Kh',
      // Player 1 hole cards
      'Qd', 'Qc',
    )

    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 2,
      blinds: { sb: 25, bb: 50 },
      rng: makeRiggedRng(riggedCards),
    }

    let table = createTable(config)

    // Seat players
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000, name: 'Alice' })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000, name: 'Bob' })

    // Start hand
    table = reduce(table, { type: 'START_HAND' })

    // Check dealt cards match our rigged deck
    expect(table.seats[0].hole).toEqual([
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 'h' },
    ])
    expect(table.seats[1].hole).toEqual([
      { rank: 'Q', suit: 'd' },
      { rank: 'Q', suit: 'c' },
    ])
  })

  it('should track history events for START_HAND', () => {
    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 3,
      blinds: { sb: 50, bb: 100 },
      ante: 10,
      seed: 777,
    }

    let table = createTable(config)

    // Seat players
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000, name: 'Alice' })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000, name: 'Bob' })
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000, name: 'Charlie' })

    // Clear history from seating
    table.history = []

    // Start hand
    table = reduce(table, { type: 'START_HAND' })

    // Check history includes START_HAND event (after POST events)
    const startEvent = table.history.find(e => e.kind === 'START_HAND')
    expect(startEvent).toBeDefined()
    expect(startEvent?.at).toBe(2) // After 2 POST events
    expect(startEvent?.data).toMatchObject({
      handId: 1,
      button: 0,
      sbIndex: 1,
      bbIndex: 2,
    })
  })

  it('should handle heads-up blind rotation across multiple hands', () => {
    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 2,
      blinds: { sb: 25, bb: 50 },
      seed: 555,
    }

    let table = createTable(config)

    // Seat 2 players
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000, name: 'Alice' })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000, name: 'Bob' })

    // Hand 1
    table = reduce(table, { type: 'START_HAND' })
    expect(table.handId).toBe(1)
    expect(table.button).toBe(0)
    expect(table.sbIndex).toBe(0) // Button is SB in heads-up
    expect(table.bbIndex).toBe(1)
    expect(table.actionOn).toBe(0) // SB/Button acts first preflop in HU

    // Complete hand 1
    table = reduce(table, { type: 'FOLD', seat: 0 })
    expect(table.street).toBe('COMPLETE')

    // Hand 2 - verify rotation
    table = reduce(table, { type: 'START_HAND' })
    expect(table.handId).toBe(2)
    expect(table.button).toBe(1) // Button moved
    expect(table.sbIndex).toBe(1) // New button is SB
    expect(table.bbIndex).toBe(0)
    expect(table.actionOn).toBe(1) // New SB/Button acts first preflop

    // Get to flop to verify postflop order
    table = reduce(table, { type: 'CALL', seat: 1 })
    table = reduce(table, { type: 'CHECK', seat: 0 })
    expect(table.street).toBe('FLOP')
    expect(table.actionOn).toBe(1) // SB/Button acts first postflop in HU
  })

  it('should handle button/blind movement with player elimination', () => {
    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 4,
      blinds: { sb: 50, bb: 100 },
      seed: 666,
    }

    let table = createTable(config)

    // Seat 4 players
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 200, name: 'ShortStack' })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 5000, name: 'Alice' })
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 5000, name: 'Bob' })
    table = reduce(table, { type: 'SIT', seat: 3, buyin: 5000, name: 'Charlie' })

    // Hand 1 - all 4 players
    table = reduce(table, { type: 'START_HAND' })
    expect(table.button).toBe(0)
    expect(table.sbIndex).toBe(1)
    expect(table.bbIndex).toBe(2)

    // Simulate seat 0 (BTN) going all-in and losing (elimination)
    // With 4 players: BTN=0, SB=1, BB=2, UTG=3
    // Action starts with UTG (seat 3)
    table = reduce(table, { type: 'FOLD', seat: 3 })  // UTG folds
    table = reduce(table, { type: 'ALL_IN', seat: 0 }) // BTN all-in
    table = reduce(table, { type: 'FOLD', seat: 1 })   // SB folds
    table = reduce(table, { type: 'CALL', seat: 2 })   // BB calls

    // Simulate showdown where seat 2 wins, seat 0 eliminated
    table.street = 'COMPLETE'
    table.seats[0].stack = 0  // Eliminated
    table.seats[0].buyin = 0  // Mark as busted

    // Hand 2 - button should skip eliminated player
    table = reduce(table, { type: 'START_HAND' })
    expect(table.button).toBe(1)  // Button moves to next active player
    expect(table.sbIndex).toBe(2)
    expect(table.bbIndex).toBe(3)

    // Verify only 3 active players
    const activePlayers = table.seats.filter(s => s.stack > 0)
    expect(activePlayers).toHaveLength(3)
  })

  it('should move button correctly across hands (3-handed)', () => {
    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 3,
      blinds: { sb: 50, bb: 100 },
      seed: 444,
    }

    let table = createTable(config)

    // Seat 3 players
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 5000, name: 'Alice' })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 5000, name: 'Bob' })
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 5000, name: 'Charlie' })

    // Hand 1
    table = reduce(table, { type: 'START_HAND' })
    expect(table.handId).toBe(1)
    expect(table.button).toBe(0)
    expect(table.sbIndex).toBe(1)
    expect(table.bbIndex).toBe(2)
    expect(table.actionOn).toBe(0) // UTG (left of BB)

    // Simulate hand completion
    table.street = 'COMPLETE'

    // Hand 2
    table = reduce(table, { type: 'START_HAND' })
    expect(table.handId).toBe(2)
    expect(table.button).toBe(1) // Moved from 0 to 1
    expect(table.sbIndex).toBe(2)
    expect(table.bbIndex).toBe(0)
    expect(table.actionOn).toBe(1) // UTG (left of BB)

    // Simulate hand completion
    table.street = 'COMPLETE'

    // Hand 3
    table = reduce(table, { type: 'START_HAND' })
    expect(table.handId).toBe(3)
    expect(table.button).toBe(2) // Moved from 1 to 2
    expect(table.sbIndex).toBe(0)
    expect(table.bbIndex).toBe(1)
    expect(table.actionOn).toBe(2) // UTG (left of BB)
  })
})