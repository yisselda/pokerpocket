import { describe, it, expect } from 'vitest'
import * as betting from '../../src/betting.js'

describe('three-way side pots', () => {
  it('should create main and side pots correctly with all-in player', () => {
    // P0: 500 chips, P1: 1000 chips, P2: 200 chips (short stack)
    let bettingState = betting.initBetting(3, [500, 1000, 200], 0)
    const config = { smallBlind: 10, bigBlind: 20 }
    bettingState = betting.postBlinds(bettingState, config)

    // P2 (short stack) goes all-in preflop for 180 remaining
    bettingState = betting.applyAction(bettingState, {
      player: 2, // UTG
      type: 'allin',
    })

    expect(bettingState.players[2].stack).toBe(0)
    expect(bettingState.players[2].totalCommitted).toBe(200)
    expect(bettingState.currentBet).toBe(200)

    // P0 (button) calls
    bettingState = betting.applyAction(bettingState, {
      player: 0,
      type: 'call',
    })

    expect(bettingState.players[0].totalCommitted).toBe(200) // 10 SB + 190 call

    // P1 (BB) calls
    bettingState = betting.applyAction(bettingState, {
      player: 1,
      type: 'call',
    })

    expect(bettingState.players[1].totalCommitted).toBe(200) // 20 BB + 180 call

    expect(betting.isRoundComplete(bettingState)).toBe(true)

    // Build pots - should create one main pot since all committed same amount
    const pots = betting.buildPots(bettingState.players)

    expect(pots).toHaveLength(1)
    expect(pots[0].amount).toBe(600) // 200 * 3 players
    expect(pots[0].eligiblePlayers).toEqual([0, 1, 2])
  })

  it('should create multiple side pots with different all-in amounts', () => {
    // Create scenario with multiple all-ins at different levels
    let bettingState = betting.initBetting(3, [300, 600, 100], 0)
    const config = { smallBlind: 5, bigBlind: 10 }
    bettingState = betting.postBlinds(bettingState, config)

    // P2 (shortest) goes all-in for 90 remaining
    bettingState = betting.applyAction(bettingState, {
      player: 2,
      type: 'allin',
    })

    expect(bettingState.players[2].totalCommitted).toBe(100)

    // P0 raises to 245 total
    bettingState = betting.applyAction(bettingState, {
      player: 0,
      type: 'raise',
      amount: 245, // P0 had 0 committed initially
    })

    expect(bettingState.players[0].totalCommitted).toBe(245)

    // P1 goes all-in for 590 more (600 total)
    bettingState = betting.applyAction(bettingState, {
      player: 1,
      type: 'allin',
    })

    expect(bettingState.players[1].totalCommitted).toBe(600)

    // P0 calls remaining
    bettingState = betting.applyAction(bettingState, {
      player: 0,
      type: 'call',
    })

    expect(bettingState.players[0].totalCommitted).toBe(300) // All of P0's stack

    const pots = betting.buildPots(bettingState.players)

    // Should create multiple pots:
    // Main pot: 100 * 3 = 300 (everyone eligible)
    // Side pot 1: (300-100) * 2 = 400 (P0, P1 eligible)
    // Side pot 2: (600-300) * 1 = 300 (P1 only eligible)

    expect(pots).toHaveLength(3)

    expect(pots[0].amount).toBe(300)
    expect(pots[0].eligiblePlayers).toEqual(expect.arrayContaining([0, 1, 2]))

    expect(pots[1].amount).toBe(400)
    expect(pots[1].eligiblePlayers).toEqual(expect.arrayContaining([0, 1]))

    expect(pots[2].amount).toBe(300)
    expect(pots[2].eligiblePlayers).toEqual([1])

    // Total should equal all chips committed
    const totalPot = pots.reduce((sum, pot) => sum + pot.amount, 0)
    expect(totalPot).toBe(1000) // 100 + 300 + 600
  })

  it('should handle folded players in side pot calculations', () => {
    let bettingState = betting.initBetting(4, [200, 400, 300, 500], 0)
    const config = { smallBlind: 5, bigBlind: 10 }
    bettingState = betting.postBlinds(bettingState, config)

    // P3 folds
    bettingState = betting.applyAction(bettingState, {
      player: 3,
      type: 'fold',
    })

    // P0 raises to 100
    bettingState = betting.applyAction(bettingState, {
      player: 0,
      type: 'raise',
      amount: 100,
    })

    // P1 calls
    bettingState = betting.applyAction(bettingState, {
      player: 1,
      type: 'call',
    })

    // P2 calls
    bettingState = betting.applyAction(bettingState, {
      player: 2,
      type: 'call',
    })

    const pots = betting.buildPots(bettingState.players)

    // Should create one pot since everyone called the same amount
    expect(pots).toHaveLength(1)

    // Main pot: 100 * 3 active players = 300
    expect(pots[0].amount).toBe(300)
    expect(pots[0].eligiblePlayers).toEqual(expect.arrayContaining([0, 1, 2]))

    const totalFromActive = bettingState.players
      .filter(p => !p.hasFolded)
      .reduce((sum, p) => sum + p.totalCommitted, 0)

    expect(totalFromActive).toBe(300)
  })
})
