import { describe, it, expect } from 'vitest'
import { PokerEngine } from '../src/engine.js'

describe('Engine Flow', () => {
  it('seed reproducibility - seed 12345 produces consistent results', () => {
    const engine1 = new PokerEngine()
    const engine2 = new PokerEngine()

    engine1.setSeed(12345)
    engine1.deal()

    engine2.setSeed(12345)
    engine2.deal()

    const status1 = engine1.status()
    const status2 = engine2.status()

    expect(status1.holeCounts).toEqual(status2.holeCounts)
    expect(status1.phase).toBe(status2.phase)

    engine1.flop()
    engine2.flop()

    const boardStatus1 = engine1.status()
    const boardStatus2 = engine2.status()

    expect(boardStatus1.boardAscii).toBe(boardStatus2.boardAscii)
  })

  it('flow guards - cannot river before turn', () => {
    const engine = new PokerEngine()
    engine.deal()
    engine.flop()

    expect(() => engine.river()).toThrow('Can only river from turn phase')
  })

  it('flow guards - cannot turn before flop', () => {
    const engine = new PokerEngine()
    engine.deal()

    expect(() => engine.turn()).toThrow('Can only turn from flop phase')
  })

  it('flow guards - cannot change players mid-hand', () => {
    const engine = new PokerEngine()
    engine.deal()

    expect(() => engine.setPlayers(4)).toThrow('Cannot change players mid-hand')
  })

  it('early showdown at flop produces deterministic results', () => {
    const engine = new PokerEngine()
    engine.setSeed(12345)
    engine.deal()
    engine.flop()

    const result1 = engine.showdown()

    engine.setSeed(12345)
    engine.deal()
    engine.flop()

    const result2 = engine.showdown()

    expect(result1.winners).toEqual(result2.winners)
    expect(result1.results.length).toBe(result2.results.length)

    result1.results.forEach((res1, i) => {
      const res2 = result2.results[i]
      expect(res1.player).toBe(res2.player)
      expect(res1.eval.rank).toBe(res2.eval.rank)
      expect(res1.eval.tiebreak).toEqual(res2.eval.tiebreak)
    })
  })

  it('early showdown at turn produces deterministic results', () => {
    const engine = new PokerEngine()
    engine.setSeed(12345)
    engine.deal()
    engine.flop()
    engine.turn()

    const result1 = engine.showdown()

    engine.setSeed(12345)
    engine.deal()
    engine.flop()
    engine.turn()

    const result2 = engine.showdown()

    expect(result1.winners).toEqual(result2.winners)
    expect(result1.results.length).toBe(result2.results.length)
  })

  it('status shows correct next commands', () => {
    const engine = new PokerEngine()

    let status = engine.status()
    expect(status.nextCmdHints).toContain('deal')
    expect(status.nextCmdHints).toContain('players <n>')

    engine.deal()
    status = engine.status()
    expect(status.nextCmdHints).toContain('flop')

    engine.flop()
    status = engine.status()
    expect(status.nextCmdHints).toContain('turn')
    expect(status.nextCmdHints).toContain('showdown')

    engine.turn()
    status = engine.status()
    expect(status.nextCmdHints).toContain('river')
    expect(status.nextCmdHints).toContain('showdown')

    engine.river()
    status = engine.status()
    expect(status.nextCmdHints).toContain('showdown')
  })

  it('setPlayers works in IDLE phase', () => {
    const engine = new PokerEngine()
    engine.setPlayers(9)

    const status = engine.status()
    expect(status.players).toBe(9)
  })

  it('setSeed affects next deal', () => {
    const engine = new PokerEngine()
    engine.setSeed(54321)
    engine.deal()
    engine.flop()

    const board1 = engine.status().boardAscii

    engine.setSeed(54321)
    engine.deal()
    engine.flop()

    const board2 = engine.status().boardAscii

    expect(board1).toBe(board2)
  })

  it('cannot showdown before flop', () => {
    const engine = new PokerEngine()
    engine.deal()

    expect(() => engine.showdown()).toThrow(
      'Can only showdown from flop, turn, or river phase'
    )
  })

  it('player validation', () => {
    const engine = new PokerEngine()

    expect(() => engine.setPlayers(1)).toThrow(
      'Players must be between 2 and 9'
    )
    expect(() => engine.setPlayers(10)).toThrow(
      'Players must be between 2 and 9'
    )
  })

  it('getHoleCards returns correct cards for valid players', () => {
    const engine = new PokerEngine()
    engine.setPlayers(3)
    engine.setSeed(12345)
    engine.deal()

    const p1Cards = engine.getHoleCards(0)
    const p2Cards = engine.getHoleCards(1)
    const p3Cards = engine.getHoleCards(2)

    expect(p1Cards).toHaveLength(2)
    expect(p2Cards).toHaveLength(2)
    expect(p3Cards).toHaveLength(2)

    // Cards should be different objects
    expect(p1Cards).not.toEqual(p2Cards)
    expect(p1Cards).not.toEqual(p3Cards)
    expect(p2Cards).not.toEqual(p3Cards)
  })

  it('getHoleCards throws for invalid player numbers', () => {
    const engine = new PokerEngine()
    engine.setPlayers(3)
    engine.deal()

    expect(() => engine.getHoleCards(-1)).toThrow(
      'Invalid player -1. Must be 0-2'
    )
    expect(() => engine.getHoleCards(3)).toThrow(
      'Invalid player 3. Must be 0-2'
    )
    expect(() => engine.getHoleCards(5)).toThrow(
      'Invalid player 5. Must be 0-2'
    )
  })

  it('getHoleCards returns empty array before deal', () => {
    const engine = new PokerEngine()
    engine.setPlayers(3)

    const p1Cards = engine.getHoleCards(0)
    expect(p1Cards).toEqual([])
  })

  it('getHoleCards works with different player counts', () => {
    // Test with 2 players
    const engine2 = new PokerEngine()
    engine2.setPlayers(2)
    engine2.deal()
    expect(engine2.getHoleCards(0)).toHaveLength(2)
    expect(engine2.getHoleCards(1)).toHaveLength(2)
    expect(() => engine2.getHoleCards(2)).toThrow(
      'Invalid player 2. Must be 0-1'
    )

    // Test with 9 players
    const engine9 = new PokerEngine()
    engine9.setPlayers(9)
    engine9.deal()
    for (let i = 0; i < 9; i++) {
      expect(engine9.getHoleCards(i)).toHaveLength(2)
    }
    expect(() => engine9.getHoleCards(9)).toThrow(
      'Invalid player 9. Must be 0-8'
    )
  })
})
