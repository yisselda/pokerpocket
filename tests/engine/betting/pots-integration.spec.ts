import { describe, it, expect } from 'vitest'
import { createTable, reduce } from '../../../src/index.js'
import { TableConfig } from '../../../src/engine/betting/types.js'

describe('Pot calculation integration', () => {
  it('should calculate pots correctly during real game (3-handed)', () => {
    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 3,
      blinds: { sb: 50, bb: 100 },
      seed: 123,
    }

    let table = createTable(config)

    // Three players with different stacks
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 300 })  // Short stack
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 2000 })
    table = reduce(table, { type: 'START_HAND' })

    // Preflop: BTN raises, SB goes all-in, BB calls
    table = reduce(table, { type: 'RAISE', seat: 0, to: 200 })   // BTN raises
    table = reduce(table, { type: 'ALL_IN', seat: 1 })            // SB all-in for 300 total
    table = reduce(table, { type: 'RAISE', seat: 2, to: 500 })   // BB re-raises
    table = reduce(table, { type: 'CALL', seat: 0 })             // BTN calls 500

    // Check that street advanced and pots are calculated
    expect(table.street).toBe('FLOP')
    expect(table.pots).toHaveLength(2)

    // Main pot: 300 * 3 = 900 (all three players)
    expect(table.pots[0].amount).toBe(900)
    expect(table.pots[0].eligible).toContain('seat_0')
    expect(table.pots[0].eligible).toContain('seat_1')
    expect(table.pots[0].eligible).toContain('seat_2')

    // Side pot: 200 * 2 = 400 (BTN and BB)
    expect(table.pots[1].amount).toBe(400)
    expect(table.pots[1].eligible).toContain('seat_0')
    expect(table.pots[1].eligible).toContain('seat_2')
    expect(table.pots[1].eligible).not.toContain('seat_1')
  })

  it('should handle multiple all-ins creating multiple side pots (4-handed)', () => {
    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 4,
      blinds: { sb: 10, bb: 20 },
      seed: 456,
    }

    let table = createTable(config)

    // Four players with escalating stacks
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 50 })   // Button - tiny stack
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 100 })  // SB - small stack
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 200 })  // BB - medium stack
    table = reduce(table, { type: 'SIT', seat: 3, buyin: 500 })  // UTG - big stack
    table = reduce(table, { type: 'START_HAND' })

    // In 4-player, action is UTG (3), BTN (0), SB (1), BB (2)
    table = reduce(table, { type: 'ALL_IN', seat: 3 })  // UTG all-in for 500
    table = reduce(table, { type: 'ALL_IN', seat: 0 })  // BTN all-in for 50
    table = reduce(table, { type: 'ALL_IN', seat: 1 })  // SB all-in for 100
    table = reduce(table, { type: 'CALL', seat: 2 })    // BB calls 200 (all-in)

    expect(table.street).toBe('FLOP')
    expect(table.pots).toHaveLength(4)

    // Main pot: 50 * 4 = 200
    expect(table.pots[0].amount).toBe(200)
    expect(table.pots[0].eligible).toHaveLength(4)

    // Side pot 1: 50 * 3 = 150
    expect(table.pots[1].amount).toBe(150)
    expect(table.pots[1].eligible).toHaveLength(3)

    // Side pot 2: 100 * 2 = 200
    expect(table.pots[2].amount).toBe(200)
    expect(table.pots[2].eligible).toHaveLength(2)

    // Side pot 3: 300 * 1 = 300 (UTG's extra money)
    expect(table.pots[3].amount).toBe(300)
    expect(table.pots[3].eligible).toHaveLength(1)
  })

  it('should handle 6-player all-in cascade with multiple side pots', () => {
    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 6,
      blinds: { sb: 5, bb: 10 },
      seed: 101,
    }

    let table = createTable(config)

    // Six players with staggered stacks
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 100 })  // BTN
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 250 })  // SB
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 400 })  // BB
    table = reduce(table, { type: 'SIT', seat: 3, buyin: 600 })  // UTG
    table = reduce(table, { type: 'SIT', seat: 4, buyin: 800 })  // MP
    table = reduce(table, { type: 'SIT', seat: 5, buyin: 1000 }) // CO
    table = reduce(table, { type: 'START_HAND' })

    // All players go all-in in sequence
    table = reduce(table, { type: 'ALL_IN', seat: 3 })  // UTG all-in 600
    table = reduce(table, { type: 'ALL_IN', seat: 4 })  // MP all-in 800
    table = reduce(table, { type: 'ALL_IN', seat: 5 })  // CO all-in 1000
    table = reduce(table, { type: 'ALL_IN', seat: 0 })  // BTN all-in 100
    table = reduce(table, { type: 'ALL_IN', seat: 1 })  // SB all-in 250 (245 + 5)
    table = reduce(table, { type: 'ALL_IN', seat: 2 })  // BB all-in 400 (390 + 10)

    // Should advance to flop with multiple pots
    expect(table.street).toBe('FLOP')
    expect(table.pots.length).toBeGreaterThan(1)

    // Main pot: 100 * 6 = 600 (all 6 players)
    expect(table.pots[0].amount).toBe(600)
    expect(table.pots[0].eligible).toHaveLength(6)

    // Side pot 1: 150 * 5 = 750 (5 players with 250+)
    expect(table.pots[1].amount).toBe(750)
    expect(table.pots[1].eligible).toHaveLength(5)
    expect(table.pots[1].eligible).not.toContain('seat_0')

    // Side pot 2: 150 * 4 = 600 (4 players with 400+)
    expect(table.pots[2].amount).toBe(600)
    expect(table.pots[2].eligible).toHaveLength(4)

    // Side pot 3: 200 * 3 = 600 (3 players with 600+)
    expect(table.pots[3].amount).toBe(600)
    expect(table.pots[3].eligible).toHaveLength(3)

    // Side pot 4: 200 * 2 = 400 (2 players with 800+)
    expect(table.pots[4].amount).toBe(400)
    expect(table.pots[4].eligible).toHaveLength(2)

    // Side pot 5: 200 * 1 = 200 (only CO with 1000)
    expect(table.pots[5].amount).toBe(200)
    expect(table.pots[5].eligible).toHaveLength(1)
    expect(table.pots[5].eligible).toContain('seat_5')
  })

  it('should handle folded players contributions in pots (3-handed)', () => {
    const config: TableConfig = {
      variant: 'NLHE',
      maxSeats: 3,
      blinds: { sb: 50, bb: 100 },
      seed: 789,
    }

    let table = createTable(config)

    table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 200 })   // Will fold
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 500 })   // Will go all-in
    table = reduce(table, { type: 'START_HAND' })

    // Preflop action
    table = reduce(table, { type: 'RAISE', seat: 0, to: 200 })    // BTN raises
    table = reduce(table, { type: 'CALL', seat: 1 })               // SB calls 200 (all-in)
    table = reduce(table, { type: 'ALL_IN', seat: 2 })            // BB goes all-in for 500
    table = reduce(table, { type: 'FOLD', seat: 0 })              // BTN folds

    // SB is all-in, BB is all-in, BTN folded after contributing 200
    expect(table.street).toBe('FLOP')
    expect(table.pots).toHaveLength(2)

    // Main pot includes folded player's money: 200 * 3 = 600
    expect(table.pots[0].amount).toBe(600)
    expect(table.pots[0].eligible).toHaveLength(2)  // Only SB and BB eligible
    expect(table.pots[0].eligible).not.toContain('seat_0')  // BTN folded

    // Side pot: BB's extra 300
    expect(table.pots[1].amount).toBe(300)
    expect(table.pots[1].eligible).toHaveLength(1)  // Only BB
  })
})