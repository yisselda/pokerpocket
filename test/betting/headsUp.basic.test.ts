import { describe, it, expect } from 'vitest'
import { newGame } from '../../src/engine.js'
import * as betting from '../../src/betting.js'

describe('heads-up basic betting', () => {
  it('should handle blinds posting and basic betting flow', () => {
    const engine = newGame({ players: 2, seed: 42 })
    engine.deal()

    // Initialize betting with stacks
    let bettingState = betting.initBetting(2, [1000, 1000], 0)

    // Post blinds: P0 (button) posts SB, P1 posts BB
    const config = { smallBlind: 50, bigBlind: 100 }
    bettingState = betting.postBlinds(bettingState, config)

    expect(bettingState.players[0].stack).toBe(950) // Button posts SB: 50
    expect(bettingState.players[1].stack).toBe(900) // Other posts BB: 100
    expect(bettingState.currentBet).toBe(100)
    expect(bettingState.actingIndex).toBe(0) // Button to act first preflop

    // P0 (button) raises to 300
    const p0Actions = betting.legalActions(bettingState, 0)
    expect(p0Actions.some(a => a.type === 'raise')).toBe(true)
    expect(p0Actions.some(a => a.type === 'call')).toBe(true)
    expect(p0Actions.some(a => a.type === 'fold')).toBe(true)

    bettingState = betting.applyAction(bettingState, {
      player: 0,
      type: 'raise',
      amount: 250 // Total bet 300 (50 committed + 250)
    })

    expect(bettingState.players[0].stack).toBe(700)
    expect(bettingState.players[0].committed).toBe(300)
    expect(bettingState.currentBet).toBe(300)
    expect(bettingState.actingIndex).toBe(1) // P1's turn

    // P1 calls
    const p1Actions = betting.legalActions(bettingState, 1)
    expect(p1Actions.some(a => a.type === 'call')).toBe(true)

    bettingState = betting.applyAction(bettingState, {
      player: 1,
      type: 'call'
    })

    expect(bettingState.players[1].stack).toBe(700) // 900 - 200 more
    expect(bettingState.players[1].committed).toBe(300)

    // Round should be complete
    expect(betting.isRoundComplete(bettingState)).toBe(true)

    // Start flop round
    engine.flop()
    bettingState = betting.startNewRound(bettingState)

    expect(bettingState.currentBet).toBe(0)
    expect(bettingState.players[0].committed).toBe(0)
    expect(bettingState.players[1].committed).toBe(0)
    expect(bettingState.actingIndex).toBe(1) // BB acts first post-flop

    // Total pot should be tracked correctly
    expect(betting.getTotalPot(bettingState)).toBe(600)
  })

  it('should create players with default 10000 stacks', () => {
    const bettingState = betting.initBettingWithDefaults(3, 1)

    expect(bettingState.players).toHaveLength(3)
    expect(bettingState.players[0].stack).toBe(10000)
    expect(bettingState.players[1].stack).toBe(10000)
    expect(bettingState.players[2].stack).toBe(10000)
    expect(bettingState.buttonIndex).toBe(1)
  })

  it('should allow custom default stack size', () => {
    const bettingState = betting.initBettingWithDefaults(2, 0, 5000)

    expect(bettingState.players[0].stack).toBe(5000)
    expect(bettingState.players[1].stack).toBe(5000)
  })

  it('should handle all-in scenarios', () => {
    let bettingState = betting.initBetting(2, [200, 1000], 0)
    const config = { smallBlind: 50, bigBlind: 100 }
    bettingState = betting.postBlinds(bettingState, config)

    // P0 has only 150 left after posting SB
    expect(bettingState.players[0].stack).toBe(150)

    // P0 goes all-in
    bettingState = betting.applyAction(bettingState, {
      player: 0,
      type: 'allin'
    })

    expect(bettingState.players[0].stack).toBe(0)
    expect(bettingState.players[0].isAllIn).toBe(true)
    expect(bettingState.currentBet).toBe(200) // P0's total commitment

    // P1 calls
    bettingState = betting.applyAction(bettingState, {
      player: 1,
      type: 'call'
    })

    expect(betting.isRoundComplete(bettingState)).toBe(true)
    expect(betting.getTotalPot(bettingState)).toBe(400)
  })

  it('should calculate legal actions correctly', () => {
    let bettingState = betting.initBetting(2, [500, 500], 0)
    const config = { smallBlind: 25, bigBlind: 50 }
    bettingState = betting.postBlinds(bettingState, config)

    // P0 to act, can fold/call/raise/allin
    const actions = betting.legalActions(bettingState, 0)
    const actionTypes = actions.map(a => a.type)

    expect(actionTypes).toContain('fold')
    expect(actionTypes).toContain('call')
    expect(actionTypes).toContain('raise')
    expect(actionTypes).toContain('allin')

    const raiseAction = actions.find(a => a.type === 'raise')
    expect(raiseAction?.min).toBe(75) // Call 25 + min raise 50
    expect(raiseAction?.max).toBe(475) // All remaining chips
  })
})