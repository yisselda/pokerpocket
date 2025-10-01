import { describe, it, expect } from 'vitest'
import { createTable, reduce, type TableState } from '../../../src/index.js'

describe('Round completion logic', () => {
  it('should not complete round after first check when no bet', () => {
    // Setup 3-player game
    let table = createTable({
      variant: 'NLHE',
      maxSeats: 3,
      blinds: { sb: 50, bb: 100 },
    })

    // Add players
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })

    // Start hand
    table = reduce(table, { type: 'START_HAND' })

    // Everyone calls preflop
    table = reduce(table, { type: 'CALL', seat: 0 }) // UTG calls
    table = reduce(table, { type: 'CALL', seat: 1 }) // SB calls
    table = reduce(table, { type: 'CHECK', seat: 2 }) // BB checks

    // Should advance to flop
    expect(table.street).toBe('FLOP')

    // First player checks on flop
    const tableAfterFirstCheck = reduce(table, { type: 'CHECK', seat: 1 }) // SB checks

    // Should NOT advance street yet - others haven't acted
    expect(tableAfterFirstCheck.street).toBe('FLOP')
    expect(tableAfterFirstCheck.actionOn).toBe(2) // BB to act

    // Second player checks
    const tableAfterSecondCheck = reduce(tableAfterFirstCheck, {
      type: 'CHECK',
      seat: 2,
    })
    expect(tableAfterSecondCheck.street).toBe('FLOP')
    expect(tableAfterSecondCheck.actionOn).toBe(0) // Button to act

    // Third player checks - NOW round is complete
    const tableAfterThirdCheck = reduce(tableAfterSecondCheck, {
      type: 'CHECK',
      seat: 0,
    })
    expect(tableAfterThirdCheck.street).toBe('TURN')
  })

  it('should reopen action after raise and require all to act again', () => {
    let table = createTable({
      variant: 'NLHE',
      maxSeats: 3,
      blinds: { sb: 50, bb: 100 },
    })

    // Add players
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })

    // Start hand
    table = reduce(table, { type: 'START_HAND' })

    // UTG raises
    table = reduce(table, { type: 'RAISE', seat: 0, to: 300 })

    // SB calls
    table = reduce(table, { type: 'CALL', seat: 1 })

    // BB should still need to act - round not complete
    expect(table.street).toBe('PREFLOP')
    expect(table.actionOn).toBe(2)

    // BB raises (re-raise)
    table = reduce(table, { type: 'RAISE', seat: 2, to: 900 })

    // Now UTG and SB must act again because action reopened
    expect(table.street).toBe('PREFLOP')
    expect(table.actionOn).toBe(0) // Back to UTG

    // UTG folds
    table = reduce(table, { type: 'FOLD', seat: 0 })
    expect(table.street).toBe('PREFLOP')

    // SB must still act
    table = reduce(table, { type: 'CALL', seat: 1 })

    // Now round is complete, should advance
    expect(table.street).toBe('FLOP')
  })

  it('should handle all-in that reopens action', () => {
    let table = createTable({
      variant: 'NLHE',
      maxSeats: 3,
      blinds: { sb: 50, bb: 100 },
    })

    // Add players with different stacks
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 500 })
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })

    // Start hand
    table = reduce(table, { type: 'START_HAND' })

    // UTG bets 200
    table = reduce(table, { type: 'RAISE', seat: 0, to: 200 })

    // SB goes all-in for 450 (raise of 250, which is > BB so reopens)
    table = reduce(table, { type: 'ALL_IN', seat: 1 })

    // BB should need to act
    expect(table.street).toBe('PREFLOP')
    expect(table.actionOn).toBe(2)

    // BB folds
    table = reduce(table, { type: 'FOLD', seat: 2 })

    // UTG should need to act again (action reopened by all-in)
    expect(table.street).toBe('PREFLOP')
    expect(table.actionOn).toBe(0)

    // UTG calls
    table = reduce(table, { type: 'CALL', seat: 0 })

    // Now should advance (only 1 active player left)
    expect(table.street).toBe('FLOP')
  })

  it('should not allow BB to fold when everyone limps', async () => {
    let table = createTable({
      variant: 'NLHE',
      maxSeats: 3,
      blinds: { sb: 50, bb: 100 },
    })

    // Add players
    table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
    table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
    table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })

    // Start hand
    table = reduce(table, { type: 'START_HAND' })

    // Everyone limps to BB
    table = reduce(table, { type: 'CALL', seat: 0 }) // UTG calls
    table = reduce(table, { type: 'CALL', seat: 1 }) // SB calls

    // BB should be acting with option
    expect(table.actionOn).toBe(2)

    // Get legal actions for BB
    const { getLegalActions } = await import('../../../src/index.js')
    const bbActions = getLegalActions(table, 2)

    // BB should NOT be able to fold
    expect(bbActions.canFold).toBe(false)
    expect(bbActions.canCheck).toBe(true)
    expect(bbActions.canRaise).toBe(true)
  })
})
