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

      // BB acts first in heads-up preflop (seat 1)
      expect(table.actionOn).toBe(1)

      // BB can check or raise
      const bb = getLegalActions(table, 1)
      expect(bb.canCheck).toBe(true)
      expect(bb.canRaise).toBe(true)

      // BB calls (checks)
      table = reduce(table, { type: 'CHECK', seat: 1 })

      // Now Button/SB acts (seat 0) - has 100 left after posting
      expect(table.actionOn).toBe(0)
      const sb = getLegalActions(table, 0)
      expect(sb.canCall).toBe(false) // No bet to call (BB checked)
      expect(sb.canCheck).toBe(true)
      expect(sb.canRaise).toBe(true) // Can raise
      expect(sb.maxRaiseTo).toBe(150) // Can go up to all-in (50 posted + 100 stack)

      // SB raises all-in
      table = reduce(table, { type: 'ALL_IN', seat: 0 })
      expect(table.seats[0].allIn).toBe(true)
      expect(table.currentBet).toBe(150)

      // BB can call the all-in
      const bb2 = getLegalActions(table, 1)
      expect(bb2.canCall).toBe(true)
      expect(bb2.callAmount).toBe(50) // 150 - 100 already posted
      expect(bb2.canRaise).toBe(false) // Can't raise an all-in that's less than min raise
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
    it('should advance action clockwise skipping folded/all-in players', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 4,
        blinds: { sb: 50, bb: 100 },
        seed: 222,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 3, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // Initial action on seat 3 (UTG, left of BB at seat 2)
      expect(table.actionOn).toBe(3)

      // Seat 3 calls
      table = reduce(table, { type: 'CALL', seat: 3 })
      expect(table.actionOn).toBe(0) // Next active player

      // Seat 0 folds
      table = reduce(table, { type: 'FOLD', seat: 0 })
      expect(table.actionOn).toBe(1) // Skips to SB

      // Seat 1 calls
      table = reduce(table, { type: 'CALL', seat: 1 })
      expect(table.actionOn).toBe(2) // BB

      // Seat 2 checks
      table = reduce(table, { type: 'CHECK', seat: 2 })

      // Round should be complete
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
    it('should detect round closure when all players checked', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        seed: 444,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // Get to flop
      table = reduce(table, { type: 'CALL', seat: 0 })
      table = reduce(table, { type: 'CALL', seat: 1 })
      table = reduce(table, { type: 'CHECK', seat: 2 })

      // Round should be closed and auto-advance to FLOP
      expect(selectors.isRoundClosed(table)).toBe(true)
      expect(table.street).toBe('FLOP')
      expect(table.board).toHaveLength(3)
      expect(table.currentBet).toBe(0)
      expect(table.actionOn).toBe(1)

      // Everyone checks on flop
      expect(selectors.isRoundClosed(table)).toBe(false)

      table = reduce(table, { type: 'CHECK', seat: 1 })
      expect(selectors.isRoundClosed(table)).toBe(false)

      table = reduce(table, { type: 'CHECK', seat: 2 })
      expect(selectors.isRoundClosed(table)).toBe(false)

      table = reduce(table, { type: 'CHECK', seat: 0 })
      expect(selectors.isRoundClosed(table)).toBe(true)
    })

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
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 150 }) // Short stack
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // UTG goes all-in for 150
      table = reduce(table, { type: 'ALL_IN', seat: 0 })
      expect(selectors.isRoundClosed(table)).toBe(false)

      // SB calls 150
      table = reduce(table, { type: 'CALL', seat: 1 })
      expect(selectors.isRoundClosed(table)).toBe(false)

      // BB calls 50 more (100 already posted)
      table = reduce(table, { type: 'CALL', seat: 2 })

      // Round complete - all matched the bet or are all-in
      expect(selectors.isRoundClosed(table)).toBe(true)
    })

    it('should advance street when round closes', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 2,
        blinds: { sb: 50, bb: 100 },
        rng: makeRiggedRng(cards(
          // Hole cards
          'As', 'Ah', 'Kd', 'Kc',
          // Flop
          'Qh', 'Jd', 'Ts',
          // Turn
          '9c',
          // River
          '8h'
        )),
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      expect(table.street).toBe('PREFLOP')

      // Preflop: BB checks, SB checks
      table = reduce(table, { type: 'CALL', seat: 1 })
      table = reduce(table, { type: 'CHECK', seat: 0 })

      // Should advance to FLOP
      expect(table.street).toBe('FLOP')
      expect(table.board).toHaveLength(3)
      expect(table.currentBet).toBe(0)
      expect(table.actionOn).toBe(0) // SB acts first postflop

      // Flop: both check
      table = reduce(table, { type: 'CHECK', seat: 0 })
      table = reduce(table, { type: 'CHECK', seat: 1 })

      // Should advance to TURN
      expect(table.street).toBe('TURN')
      expect(table.board).toHaveLength(4)

      // Turn: both check
      table = reduce(table, { type: 'CHECK', seat: 0 })
      table = reduce(table, { type: 'CHECK', seat: 1 })

      // Should advance to RIVER
      expect(table.street).toBe('RIVER')
      expect(table.board).toHaveLength(5)

      // River: both check
      table = reduce(table, { type: 'CHECK', seat: 0 })
      table = reduce(table, { type: 'CHECK', seat: 1 })

      // Should go to SHOWDOWN then COMPLETE
      expect(table.street).toBe('SHOWDOWN')
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

    it('should identify next to act', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        seed: 888,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      expect(selectors.nextToAct(table)).toBe(0) // UTG

      table = reduce(table, { type: 'FOLD', seat: 0 })
      expect(selectors.nextToAct(table)).toBe(1) // SB

      table = reduce(table, { type: 'CALL', seat: 1 })
      expect(selectors.nextToAct(table)).toBe(2) // BB

      table = reduce(table, { type: 'CHECK', seat: 2 })
      expect(selectors.nextToAct(table)).toBe(null) // Round complete
    })
  })
})