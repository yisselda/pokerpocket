import { describe, it, expect } from 'vitest'
import {
  createTable,
  reduce,
  getLegalActions,
  type TableConfig,
} from '../../../src/index.js'

describe('No-Limit raise rules', () => {
  describe('Min-raise logic', () => {
    it('should enforce minimum raise size', () => {
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

      // UTG (seat 0) min raises to 200
      const utgActions = getLegalActions(table, 0)
      expect(utgActions.minRaiseTo).toBe(200) // 2x BB
      expect(utgActions.maxRaiseTo).toBe(1000)

      table = reduce(table, { type: 'RAISE', seat: 0, to: 200 })

      // SB (seat 1) faces raise, min re-raise is to 300 (200 + 100)
      const sbActions = getLegalActions(table, 1)
      expect(sbActions.callAmount).toBe(150) // 200 - 50 already posted
      expect(sbActions.minRaiseTo).toBe(300) // 200 + 100 (last raise size)
      expect(sbActions.maxRaiseTo).toBe(1000) // Total that can be committed

      table = reduce(table, { type: 'RAISE', seat: 1, to: 500 })

      // BB (seat 2) faces raise to 500, min re-raise is to 800
      const bbActions = getLegalActions(table, 2)
      expect(bbActions.callAmount).toBe(400) // 500 - 100 already posted
      expect(bbActions.minRaiseTo).toBe(800) // 500 + 300 (last raise was 500-200=300)
    })

    it('should handle raise-to semantics correctly', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 2,
        blinds: { sb: 25, bb: 50 },
        seed: 456,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // BB checks
      table = reduce(table, { type: 'CHECK', seat: 1 })

      // SB raises to 150 (raise-to, not raise-by)
      table = reduce(table, { type: 'RAISE', seat: 0, to: 150 })
      expect(table.currentBet).toBe(150)
      expect(table.lastRaiseSize).toBe(100) // 150 - 50 = 100

      // BB re-raises to 450 (min would be 250)
      const bbActions = getLegalActions(table, 1)
      expect(bbActions.minRaiseTo).toBe(250) // 150 + 100

      table = reduce(table, { type: 'RAISE', seat: 1, to: 450 })
      expect(table.currentBet).toBe(450)
      expect(table.lastRaiseSize).toBe(300) // 450 - 150 = 300
    })

    it('should track lastRaiseSize for unopened pots', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        seed: 789,
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

      // Should have auto-advanced to FLOP
      expect(table.street).toBe('FLOP')
      expect(table.currentBet).toBe(0)
      expect(table.lastRaiseSize).toBe(0)
      expect(table.actionOn).toBe(1) // SB acts first postflop

      // SB bets 200 on flop
      table = reduce(table, { type: 'BET', seat: 1, to: 200 })
      expect(table.currentBet).toBe(200)
      expect(table.lastRaiseSize).toBe(200) // Initial bet sets lastRaiseSize

      // BB raises to 600
      const bbActions = getLegalActions(table, 2)
      expect(bbActions.minRaiseTo).toBe(400) // 200 + 200

      table = reduce(table, { type: 'RAISE', seat: 2, to: 600 })
      expect(table.lastRaiseSize).toBe(400) // 600 - 200 = 400
    })
  })

  describe('Partial all-in (no reopen)', () => {
    it('should not reopen action for partial all-in raise', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        seed: 111,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 140 }) // Short stack
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // UTG raises to 300
      table = reduce(table, { type: 'RAISE', seat: 0, to: 300 })

      // SB goes all-in for 140 total (90 more, less than full raise)
      table = reduce(table, { type: 'ALL_IN', seat: 1 })
      expect(table.currentBet).toBe(300) // Stays at 300 (partial all-in doesn't change it)
      expect(table.seats[1].allIn).toBe(true)
      expect(table.seats[1].streetContributed).toBe(140)

      // BB can call 300 but NOT raise (partial all-in doesn't reopen)
      const bbActions = getLegalActions(table, 2)
      expect(bbActions.canCall).toBe(true)
      expect(bbActions.callAmount).toBe(200) // 300 - 100 already posted
      expect(bbActions.canRaise).toBe(false) // Cannot raise due to partial all-in

      table = reduce(table, { type: 'CALL', seat: 2 })

      // After BB calls, round is complete and should advance to FLOP
      // SB is all-in so only BB and UTG remain active
      expect(table.street).toBe('FLOP')
      expect(table.currentBet).toBe(0)
      expect(table.bettingReopened).toBe(true) // Reset for new street

      // On the flop, SB (seat 1) acts first in 3+ players
      expect(table.actionOn).toBe(2) // BB is first active player left of button
    })

    it('should reopen action for full all-in raise', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 3,
        blinds: { sb: 50, bb: 100 },
        seed: 222,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 600 }) // Enough for full raise
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // UTG raises to 300
      table = reduce(table, { type: 'RAISE', seat: 0, to: 300 })

      // SB goes all-in for 600 total (full raise and more)
      table = reduce(table, { type: 'ALL_IN', seat: 1 })
      expect(table.currentBet).toBe(600)
      expect(table.lastRaiseSize).toBe(300) // 600 - 300 = 300

      // BB CAN raise (full all-in reopened action)
      const bbActions = getLegalActions(table, 2)
      expect(bbActions.canCall).toBe(true)
      expect(bbActions.callAmount).toBe(500) // 600 - 100
      expect(bbActions.canRaise).toBe(true)
      expect(bbActions.minRaiseTo).toBe(900) // 600 + 300
    })

    it('should handle complex multi-way all-in scenarios', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 4,
        blinds: { sb: 25, bb: 50 },
        seed: 333,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 200 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 60 })
      table = reduce(table, { type: 'SIT', seat: 2, buyin: 300 })
      table = reduce(table, { type: 'SIT', seat: 3, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // Seat 3 (UTG) raises to 150
      table = reduce(table, { type: 'RAISE', seat: 3, to: 150 })

      // Seat 0 (button) goes all-in for 200 (full raise)
      table = reduce(table, { type: 'ALL_IN', seat: 0 })
      expect(table.currentBet).toBe(200)

      // Seat 1 (SB) goes all-in for 60 total (35 + 25 posted)
      table = reduce(table, { type: 'ALL_IN', seat: 1 })
      expect(table.currentBet).toBe(200) // Doesn't change (partial)

      // Seat 2 (BB) can still raise
      const bbActions = getLegalActions(table, 2)
      expect(bbActions.canRaise).toBe(true) // 200 was a full raise over 150
      expect(bbActions.minRaiseTo).toBe(250) // 200 + 50 (200-150)
    })
  })

  describe('Min bet rules', () => {
    it('should enforce BB as minimum bet size', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 2,
        blinds: { sb: 50, bb: 100 },
        seed: 444,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // Get to flop
      table = reduce(table, { type: 'CALL', seat: 1 })
      table = reduce(table, { type: 'CHECK', seat: 0 })

      // Should auto-advance to FLOP
      expect(table.street).toBe('FLOP')
      expect(table.currentBet).toBe(0)
      expect(table.lastRaiseSize).toBe(0)
      expect(table.actionOn).toBe(0) // SB/button acts first postflop in HU

      // SB/button acts first postflop, min bet is BB
      const sbActions = getLegalActions(table, 0)
      expect(sbActions.canBet).toBe(true)
      expect(sbActions.minBet).toBe(100) // BB size

      // Try to bet less than min
      expect(() => {
        reduce(table, { type: 'BET', seat: 0, to: 50 })
      }).toThrow()

      // Bet exactly min
      table = reduce(table, { type: 'BET', seat: 0, to: 100 })
      expect(table.currentBet).toBe(100)
    })

    it('should allow all-in for less than min bet', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 2,
        blinds: { sb: 50, bb: 100 },
        seed: 555,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 70 }) // Less than BB
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // BB checks, SB has only 20 left (70 - 50)
      table = reduce(table, { type: 'CHECK', seat: 1 })

      const sbActions = getLegalActions(table, 0)
      expect(sbActions.canBet).toBe(false) // Can't make min bet
      expect(sbActions.canRaise).toBe(true) // But can go all-in
      expect(sbActions.maxRaiseTo).toBe(70) // Total commitment

      // Go all-in
      table = reduce(table, { type: 'ALL_IN', seat: 0 })
      expect(table.currentBet).toBe(70)
      expect(table.seats[0].allIn).toBe(true)
    })
  })

  describe('Validation', () => {
    it('should reject raises below minimum', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 2,
        blinds: { sb: 50, bb: 100 },
        seed: 666,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // BB checks
      table = reduce(table, { type: 'CHECK', seat: 1 })

      // SB tries to raise to less than min (should be 100 min)
      expect(() => {
        reduce(table, { type: 'RAISE', seat: 0, to: 75 })
      }).toThrow('Raise must be larger than call amount')
    })

    it('should reject bets when pot is already opened', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 2,
        blinds: { sb: 50, bb: 100 },
        seed: 777,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // BB raises
      table = reduce(table, { type: 'RAISE', seat: 1, to: 200 })

      // SB cannot "bet", must use raise
      expect(() => {
        reduce(table, { type: 'BET', seat: 0, to: 300 })
      }).toThrow('Cannot bet when there is already a bet')
    })

    it('should reject raises when pot is unopened', () => {
      const config: TableConfig = {
        variant: 'NLHE',
        maxSeats: 2,
        blinds: { sb: 50, bb: 100 },
        seed: 888,
      }

      let table = createTable(config)
      table = reduce(table, { type: 'SIT', seat: 0, buyin: 1000 })
      table = reduce(table, { type: 'SIT', seat: 1, buyin: 1000 })
      table = reduce(table, { type: 'START_HAND' })

      // Get to flop
      table = reduce(table, { type: 'CALL', seat: 1 })
      table = reduce(table, { type: 'CHECK', seat: 0 })

      // Should auto-advance to FLOP
      expect(table.street).toBe('FLOP')
      expect(table.currentBet).toBe(0)
      expect(table.lastRaiseSize).toBe(0)
      expect(table.actionOn).toBe(0) // SB/button acts first postflop in HU

      // Cannot use RAISE on unopened pot
      expect(() => {
        reduce(table, { type: 'RAISE', seat: 0, to: 100 })
      }).toThrow('Cannot raise when there is no bet')
    })
  })
})