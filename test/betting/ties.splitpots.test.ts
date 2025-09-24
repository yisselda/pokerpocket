import { describe, it, expect } from 'vitest'
import { newGame } from '../../src/engine.js'
import * as betting from '../../src/betting.js'

describe('ties and split pots', () => {
  it('should split pots correctly when players tie', () => {
    const engine = newGame({ players: 3, seed: 123 })
    engine.deal()

    let bettingState = betting.initBetting(3, [1000, 1000, 1000], 0)
    const config = { smallBlind: 50, bigBlind: 100 }
    bettingState = betting.postBlinds(bettingState, config)

    // All players call to see flop
    bettingState = betting.applyAction(bettingState, { player: 0, type: 'call' }) // Button calls 100
    bettingState = betting.applyAction(bettingState, { player: 1, type: 'call' }) // SB calls 50 more
    bettingState = betting.applyAction(bettingState, { player: 2, type: 'check' }) // BB checks

    expect(betting.isRoundComplete(bettingState)).toBe(true)
    expect(betting.getTotalPot(bettingState)).toBe(300)

    // Advance to flop
    engine.flop()
    bettingState = betting.startNewRound(bettingState)

    // More betting
    bettingState = betting.applyAction(bettingState, { player: 1, type: 'bet', amount: 200 })
    bettingState = betting.applyAction(bettingState, { player: 2, type: 'call' })
    bettingState = betting.applyAction(bettingState, { player: 0, type: 'call' })

    expect(betting.getTotalPot(bettingState)).toBe(900)

    // Simulate a tie between players 0 and 1
    const winners = [0, 1] // Both players tie for best hand

    const distribution = betting.distributePots(bettingState, winners)

    // Should split the pot between the two winners
    expect(distribution).toHaveLength(2)
    expect(distribution.find(d => d.player === 0)?.amount).toBe(450)
    expect(distribution.find(d => d.player === 1)?.amount).toBe(450)
    expect(distribution.find(d => d.player === 2)).toBeUndefined()

    // Total distributed should equal total pot
    const totalDistributed = distribution.reduce((sum, d) => sum + d.amount, 0)
    expect(totalDistributed).toBe(900)
  })

  it('should handle ties in side pots correctly', () => {
    let bettingState = betting.initBetting(4, [100, 300, 200, 400], 0)
    const config = { smallBlind: 5, bigBlind: 10 }
    bettingState = betting.postBlinds(bettingState, config)

    // Create multiple all-ins for side pots
    bettingState = betting.applyAction(bettingState, { player: 2, type: 'allin' }) // 190 more
    bettingState = betting.applyAction(bettingState, { player: 3, type: 'call' }) // Calls P2's all-in
    bettingState = betting.applyAction(bettingState, { player: 0, type: 'allin' }) // 95 more
    bettingState = betting.applyAction(bettingState, { player: 1, type: 'call' }) // Calls to match everyone

    const pots = betting.buildPots(bettingState.players)

    // Should create side pots
    expect(pots.length).toBeGreaterThan(1)

    // Test tie between players eligible for main pot
    const mainPotWinners = [0, 2] // P0 and P2 tie for main pot
    const distribution = betting.distributePots(bettingState, mainPotWinners)

    // Both winners should get equal shares of pots they're eligible for
    const p0Amount = distribution.find(d => d.player === 0)?.amount ?? 0
    const p2Amount = distribution.find(d => d.player === 2)?.amount ?? 0

    expect(p0Amount).toBeGreaterThan(0)
    expect(p2Amount).toBeGreaterThan(0)

    // P2 should get more since eligible for more side pots
    expect(p2Amount).toBeGreaterThanOrEqual(p0Amount)
  })

  it('should handle three-way tie correctly', () => {
    let bettingState = betting.initBetting(3, [500, 500, 500], 0)
    const config = { smallBlind: 25, bigBlind: 50 }
    bettingState = betting.postBlinds(bettingState, config)

    // Simple betting round
    bettingState = betting.applyAction(bettingState, { player: 0, type: 'call' }) // Button calls 50
    bettingState = betting.applyAction(bettingState, { player: 1, type: 'call' }) // SB calls 25 more
    bettingState = betting.applyAction(bettingState, { player: 2, type: 'check' }) // BB checks

    expect(betting.getTotalPot(bettingState)).toBe(150)

    // All three players tie
    const winners = [0, 1, 2]
    const distribution = betting.distributePots(bettingState, winners)

    expect(distribution).toHaveLength(3)

    // Each should get equal share (50 each)
    for (const dist of distribution) {
      expect(dist.amount).toBe(50)
    }

    const totalDistributed = distribution.reduce((sum, d) => sum + d.amount, 0)
    expect(totalDistributed).toBe(150)
  })

  it('should handle odd chip distribution in splits', () => {
    let bettingState = betting.initBetting(2, [500, 500], 0)
    const config = { smallBlind: 25, bigBlind: 50 }
    bettingState = betting.postBlinds(bettingState, config)

    // Create pot with odd total (151)
    bettingState = betting.applyAction(bettingState, { player: 0, type: 'raise', amount: 76 }) // Total bet 101
    bettingState = betting.applyAction(bettingState, { player: 1, type: 'call' })

    expect(betting.getTotalPot(bettingState)).toBe(202)

    // Add one more chip to make it odd
    bettingState.players[0].totalCommitted += 1
    expect(betting.getTotalPot(bettingState)).toBe(203)

    // Both players tie
    const winners = [0, 1]
    const distribution = betting.distributePots(bettingState, winners)

    // Should floor divide (101 each, 1 chip remainder)
    expect(distribution).toHaveLength(2)
    expect(distribution[0].amount + distribution[1].amount).toBeLessThanOrEqual(203)

    // Each player should get at least 101
    for (const dist of distribution) {
      expect(dist.amount).toBeGreaterThanOrEqual(101)
    }
  })

  it('should handle winner not eligible for all pots', () => {
    // P0 short stack, P1 and P2 normal stacks
    let bettingState = betting.initBetting(3, [100, 500, 500], 0)
    const config = { smallBlind: 5, bigBlind: 10 }
    bettingState = betting.postBlinds(bettingState, config)

    // P0 goes all-in, others call and then bet more
    bettingState = betting.applyAction(bettingState, { player: 2, type: 'call' })
    bettingState = betting.applyAction(bettingState, { player: 0, type: 'allin' })
    bettingState = betting.applyAction(bettingState, { player: 1, type: 'call' })
    bettingState = betting.applyAction(bettingState, { player: 2, type: 'call' })

    // Now P1 and P2 bet more (side pot)
    bettingState = betting.startNewRound(bettingState)
    bettingState = betting.applyAction(bettingState, { player: 1, type: 'bet', amount: 100 })
    bettingState = betting.applyAction(bettingState, { player: 2, type: 'call' })

    const pots = betting.buildPots(bettingState.players)
    expect(pots.length).toBeGreaterThan(1)

    // P0 wins overall, but P1 wins side pot
    const winners = [0] // P0 has best hand overall
    const distribution = betting.distributePots(bettingState, winners)

    // P0 should only get the main pot they're eligible for
    expect(distribution).toHaveLength(1)
    expect(distribution[0].player).toBe(0)

    // P0 shouldn't get the side pot since they weren't eligible
    const p0Amount = distribution[0].amount
    const totalPot = betting.getTotalPot(bettingState)
    expect(p0Amount).toBeLessThan(totalPot)
  })
})