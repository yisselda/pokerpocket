import { describe, it, expect } from 'vitest'
import {
  createTable,
  reduce,
  getLegalActions,
  selectors,
  type TableConfig,
  type TableState,
} from '../../../src/index.js'
import { makeRiggedRng, cards } from '../../_utils/helpers.js'

describe('Betting rounds', () => {
  describe('Legal actions', () => {
    it('should compute legal actions when no bet to call', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        seed: 123,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // UTG (seat 0) faces BB
      const utg = getLegalActions(table, 0)
      expect(utg.canFold).toBe(true)
      expect(utg.canCheck).toBe(false) // Has to call BB
      expect(utg.canCall).toBe(true)
      expect(utg.callAmount).toBe(100)
      expect(utg.canBet).toBe(false) // Bet is for unopened pots
      expect(utg.canRaise).toBe(true)
      expect(utg.minRaiseTo).toBe(200) // Min raise to 2x BB
      expect(utg.maxRaiseTo).toBe(1000) // Stack size

      // Simulate UTG call
      table = reduce(table, { type: 'CALL', seat: 0 })

      // SB (seat 1) faces BB
      const sb = getLegalActions(table, 1)
      expect(sb.canFold).toBe(true)
      expect(sb.canCall).toBe(true)
      expect(sb.callAmount).toBe(50) // Already posted 50, needs 50 more
      expect(sb.canRaise).toBe(true)

      // Simulate SB call
      table = reduce(table, { type: 'CALL', seat: 1 })

      // BB (seat 2) can check (no additional to call)
      const bb = getLegalActions(table, 2)
      expect(bb.canFold).toBe(true)
      expect(bb.canCheck).toBe(true) // No more to call
      expect(bb.canCall).toBe(false)
      expect(bb.callAmount).toBe(0)
      expect(bb.canBet).toBe(false)
      expect(bb.canRaise).toBe(true) // Can still raise
    })

    it('should compute legal actions after a bet', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        seed: 456,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // Simulate getting to flop
      table = reduce(table, { type: 'CALL', seat: 0 })
      table = reduce(table, { type: 'CALL', seat: 1 })
      table = reduce(table, { type: 'CHECK', seat: 2 })

      // Should auto-advance to flop
      expect(table.street).toBe('FLOP')
      expect(table.board).toHaveLength(3)
      expect(table.currentBet).toBe(0)
      expect(table.lastRaiseSize).toBe(0)
      expect(table.actionOn).toBe(1) // SB acts first postflop

      // SB can check or bet
      const sbFlop = getLegalActions(table, 1)
      expect(sbFlop.canCheck).toBe(true)
      expect(sbFlop.canBet).toBe(true)
      expect(sbFlop.minBet).toBe(100) // BB size
      expect(sbFlop.canRaise).toBe(false) // No bet to raise

      // SB bets 200
      table = reduce(table, { type: 'BET', seat: 1, to: 200 })

      // BB faces a bet
      const bbFlop = getLegalActions(table, 2)
      expect(bbFlop.canCheck).toBe(false)
      expect(bbFlop.canCall).toBe(true)
      expect(bbFlop.callAmount).toBe(200)
      expect(bbFlop.canRaise).toBe(true)
      expect(bbFlop.minRaiseTo).toBe(400) // Min raise to 2x bet
    })

    it('should handle all-in situations', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 2,
        blinds: { sb: 50, bb: 100 },
        seed: 789,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 150 }) // Short stack
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // SB/Button acts first in heads-up preflop (seat 0)
      expect(table.actionOn).toBe(0)

      // SB needs to call 50 more
      const sb = getLegalActions(table, 0)
      expect(sb.canCall).toBe(true)
      expect(sb.callAmount).toBe(50)
      expect(sb.canRaise).toBe(true)

      // SB calls
      table = reduce(table, { type: 'CALL', seat: 0 })

      // Now BB acts (seat 1) - can check or raise
      expect(table.actionOn).toBe(1)
      const bb = getLegalActions(table, 1)
      expect(bb.canCheck).toBe(true)
      expect(bb.canRaise).toBe(true)
      expect(bb.minRaiseTo).toBe(200) // Min raise to 200

      // BB raises to 200 (min raise)
      table = reduce(table, { type: 'RAISE', seat: 1, to: 200 })
      expect(table.currentBet).toBe(200)

      // SB must go all-in to call
      const sb2 = getLegalActions(table, 0)
      expect(sb2.canCall).toBe(true)
      expect(sb2.callAmount).toBe(50) // Has 50 left after posting 100 (50 SB + 50 call)
      expect(sb2.canRaise).toBe(false) // No stack left
    })

    it('should not allow actions from folded or all-in players', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        seed: 111,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 200 })
      table = reduce(table, { type: 'START_HAND' })

      // UTG folds
      table = reduce(table, { type: 'FOLD', seat: 0 })

      // Folded player has no legal actions
      const folded = getLegalActions(table, 0)
      expect(folded.canFold).toBe(false)
      expect(folded.canCheck).toBe(false)
      expect(folded.canCall).toBe(false)
      expect(folded.canBet).toBe(false)
      expect(folded.canRaise).toBe(false)

      // SB goes all-in
      table = reduce(table, { type: 'ALL_IN', seat: 1 })

      // All-in player has no legal actions
      const allIn = getLegalActions(table, 1)
      expect(allIn.canFold).toBe(false)
      expect(allIn.canCheck).toBe(false)
      expect(allIn.canCall).toBe(false)
      expect(allIn.canBet).toBe(false)
      expect(allIn.canRaise).toBe(false)
    })
  })

  describe('Turn order', () => {
    it('should advance action clockwise skipping folded/all-in players (3-handed)', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        seed: 222,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // Initial action on seat 0 (UTG, left of BB at seat 2)
      expect(table.actionOn).toBe(0)

      // Seat 0 raises
      table = reduce(table, { type: 'RAISE', seat: 0, to: 200 })
      expect(table.actionOn).toBe(1) // SB

      // Seat 1 folds
      table = reduce(table, { type: 'FOLD', seat: 1 })
      expect(table.actionOn).toBe(2) // BB

      // Seat 2 calls
      table = reduce(table, { type: 'CALL', seat: 2 })

      // Round should be complete (heads-up now)
      expect(selectors.isRoundClosed(table)).toBe(true)
    })

    it('should handle action when only one player remains', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        seed: 333,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // UTG folds
      table = reduce(table, { type: 'FOLD', seat: 0 })
      expect(table.actionOn).toBe(1)

      // SB folds - only BB remains
      table = reduce(table, { type: 'FOLD', seat: 1 })

      // Round should be complete (only one player left)
      expect(selectors.isRoundClosed(table)).toBe(true)
      expect(table.street).toBe('COMPLETE')
      expect(table.winners).toBeDefined()
      expect(table.winners?.[0].seatId).toBe('seat_2')
    })
  })

  describe('Round closure', () => {
    it('should detect round closure when all match current bet', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        seed: 555,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // UTG raises to 300
      table = reduce(table, { type: 'RAISE', seat: 0, to: 300 })
      expect(selectors.isRoundClosed(table)).toBe(false)

      // SB calls
      table = reduce(table, { type: 'CALL', seat: 1 })
      expect(selectors.isRoundClosed(table)).toBe(false)

      // BB calls
      table = reduce(table, { type: 'CALL', seat: 2 })
      expect(selectors.isRoundClosed(table)).toBe(true)
    })

    it('should handle round closure with all-in players', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        seed: 666,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 300 }) // Bigger stack for proper all-in
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 150 }) // Short stack SB
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // UTG raises to 200
      table = reduce(table, { type: 'RAISE', seat: 0, to: 200 })

      // SB goes all-in for 150 total (100 more than posted 50)
      table = reduce(table, { type: 'ALL_IN', seat: 1 })

      // BB calls 200 (100 more than posted 100)
      table = reduce(table, { type: 'CALL', seat: 2 })

      // UTG's action - already has 200 in, nothing to call
      // Round should auto-advance since everyone matched or is all-in
      expect(table.street).toBe('FLOP')
      expect(table.seats[1].allIn).toBe(true)
    })
  })

  describe('6-max normal flow', () => {
    it('should handle 6-player betting round with open, 3bet, and calls', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 6,
        blinds: { sb: 50, bb: 100 },
        seed: 999,
      }

      let table = createTable(config)

      // Seat 6 players
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 2000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 2000 })
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 2000 })
      table = reduce(table, { type: 'SIT', seat: 3, buyin: 2000 })
      table = reduce(table, { type: 'SIT', seat: 4, buyin: 2000 })
      table = reduce(table, { type: 'SIT', seat: 5, buyin: 2000 })
      table = reduce(table, { type: 'START_HAND' })

      // Verify initial positions (button at 0, SB at 1, BB at 2, UTG at 3)
      expect(table.button).toBe(0)
      expect(table.sbIndex).toBe(1)
      expect(table.bbIndex).toBe(2)
      expect(table.actionOn).toBe(3) // UTG

      // UTG opens to 250
      const utgActions = getLegalActions(table, 3)
      expect(utgActions.canRaise).toBe(true)
      expect(utgActions.minRaiseTo).toBe(200)
      table = reduce(table, { type: 'RAISE', seat: 3, to: 250 })
      expect(table.actionOn).toBe(4) // MP

      // MP folds
      table = reduce(table, { type: 'FOLD', seat: 4 })
      expect(table.actionOn).toBe(5) // CO

      // CO 3bets to 750
      const coActions = getLegalActions(table, 5)
      expect(coActions.minRaiseTo).toBe(400) // 250 + 150
      expect(coActions.canRaise).toBe(true)
      table = reduce(table, { type: 'RAISE', seat: 5, to: 750 })
      expect(table.actionOn).toBe(0) // BTN

      // BTN calls 750
      table = reduce(table, { type: 'CALL', seat: 0 })

      // SB folds
      table = reduce(table, { type: 'FOLD', seat: 1 })

      // BB folds
      table = reduce(table, { type: 'FOLD', seat: 2 })

      // Back to UTG who calls
      expect(table.actionOn).toBe(3)
      const utgCallActions = getLegalActions(table, 3)
      expect(utgCallActions.callAmount).toBe(500) // 750 - 250 already in
      table = reduce(table, { type: 'CALL', seat: 3 })

      // Round should be closed, advance to flop
      expect(selectors.isRoundClosed(table)).toBe(true)
      expect(table.street).toBe('FLOP')

      // Verify pot calculation (750*3 + 50 + 100 = 2400)
      expect(table.pots[0].amount).toBe(2400)
      expect(table.pots[0].eligible).toContain('seat_0')
      expect(table.pots[0].eligible).toContain('seat_3')
      expect(table.pots[0].eligible).toContain('seat_5')
    })
  })

  describe('Selectors', () => {
    it('should calculate toCall correctly', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        seed: 777,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // UTG needs to call 100
      expect(selectors.toCall(table, 0)).toBe(100)

      // SB needs to call 50 more (already posted 50)
      expect(selectors.toCall(table, 1)).toBe(50)

      // BB has nothing to call
      expect(selectors.toCall(table, 2)).toBe(0)

      // UTG raises to 300
      table = reduce(table, { type: 'RAISE', seat: 0, to: 300 })

      // SB needs to call 250 more (50 posted)
      expect(selectors.toCall(table, 1)).toBe(250)

      // BB needs to call 200 more (100 posted)
      expect(selectors.toCall(table, 2)).toBe(200)
    })
  })
})
