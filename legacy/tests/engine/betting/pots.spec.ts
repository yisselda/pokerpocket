import { describe, it, expect } from 'vitest'
import { computePots } from '../../../src/engine/betting/pots.js'
import { TableState } from '../../../src/engine/betting/types.js'

describe('Side pot computation', () => {
  it('should create single pot when all players have equal contributions', () => {
    const state: Partial<TableState> = {
      seats: [
        { id: 'p1', contributed: 100, folded: false, allIn: false, stack: 0, streetContributed: 0 },
        { id: 'p2', contributed: 100, folded: false, allIn: false, stack: 0, streetContributed: 0 },
        { id: 'p3', contributed: 100, folded: false, allIn: false, stack: 0, streetContributed: 0 },
      ],
    }

    const pots = computePots(state as TableState)
    expect(pots).toHaveLength(1)
    expect(pots[0].amount).toBe(300)
    expect(pots[0].eligible).toEqual(['p1', 'p2', 'p3'])
  })

  it('should create side pot when player is all-in for less', () => {
    const state: Partial<TableState> = {
      seats: [
        { id: 'p1', contributed: 50, folded: false, allIn: true, stack: 0, streetContributed: 0 },  // All-in for 50
        { id: 'p2', contributed: 200, folded: false, allIn: false, stack: 0, streetContributed: 0 },
        { id: 'p3', contributed: 200, folded: false, allIn: false, stack: 0, streetContributed: 0 },
      ],
    }

    const pots = computePots(state as TableState)
    expect(pots).toHaveLength(2)

    // Main pot: 50 * 3 = 150
    expect(pots[0].amount).toBe(150)
    expect(pots[0].eligible).toEqual(['p1', 'p2', 'p3'])

    // Side pot: 150 * 2 = 300
    expect(pots[1].amount).toBe(300)
    expect(pots[1].eligible).toEqual(['p2', 'p3'])
  })

  it('should exclude folded players from pot eligibility', () => {
    const state: Partial<TableState> = {
      seats: [
        { id: 'p1', contributed: 100, folded: true, allIn: false, stack: 0, streetContributed: 0 },  // Folded
        { id: 'p2', contributed: 100, folded: false, allIn: false, stack: 0, streetContributed: 0 },
        { id: 'p3', contributed: 100, folded: false, allIn: false, stack: 0, streetContributed: 0 },
      ],
    }

    const pots = computePots(state as TableState)
    expect(pots).toHaveLength(1)
    expect(pots[0].amount).toBe(300)
    expect(pots[0].eligible).toEqual(['p2', 'p3'])  // p1 not eligible
  })

  it('should handle complex multi-way all-in scenario', () => {
    const state: Partial<TableState> = {
      seats: [
        { id: 'p1', contributed: 20, folded: false, allIn: true, stack: 0, streetContributed: 0 },   // All-in 20
        { id: 'p2', contributed: 50, folded: false, allIn: true, stack: 0, streetContributed: 0 },   // All-in 50
        { id: 'p3', contributed: 100, folded: false, allIn: true, stack: 0, streetContributed: 0 },  // All-in 100
        { id: 'p4', contributed: 200, folded: false, allIn: false, stack: 0, streetContributed: 0 },
      ],
    }

    const pots = computePots(state as TableState)
    expect(pots).toHaveLength(4)

    // Main pot: 20 * 4 = 80
    expect(pots[0].amount).toBe(80)
    expect(pots[0].eligible).toEqual(['p1', 'p2', 'p3', 'p4'])

    // Side pot 1: 30 * 3 = 90
    expect(pots[1].amount).toBe(90)
    expect(pots[1].eligible).toEqual(['p2', 'p3', 'p4'])

    // Side pot 2: 50 * 2 = 100
    expect(pots[2].amount).toBe(100)
    expect(pots[2].eligible).toEqual(['p3', 'p4'])

    // Side pot 3: 100 * 1 = 100
    expect(pots[3].amount).toBe(100)
    expect(pots[3].eligible).toEqual(['p4'])
  })

  it('should handle all-in with folded players', () => {
    const state: Partial<TableState> = {
      seats: [
        { id: 'p1', contributed: 50, folded: false, allIn: true, stack: 0, streetContributed: 0 },  // All-in 50
        { id: 'p2', contributed: 100, folded: true, allIn: false, stack: 0, streetContributed: 0 },  // Folded
        { id: 'p3', contributed: 150, folded: false, allIn: false, stack: 0, streetContributed: 0 },
        { id: 'p4', contributed: 150, folded: false, allIn: false, stack: 0, streetContributed: 0 },
      ],
    }

    const pots = computePots(state as TableState)
    expect(pots).toHaveLength(2)

    // Main pot: 50 * 4 = 200 (includes folded player's money)
    expect(pots[0].amount).toBe(200)
    expect(pots[0].eligible).toEqual(['p1', 'p3', 'p4'])  // Not p2

    // Side pot: 50 * 3 = 150 (p2's extra 50 + p3's 100 + p4's 100)
    expect(pots[1].amount).toBe(250)
    expect(pots[1].eligible).toEqual(['p3', 'p4'])
  })

  it('should return empty array when no contributions', () => {
    const state: Partial<TableState> = {
      seats: [
        { id: 'p1', contributed: 0, folded: false, allIn: false, stack: 100, streetContributed: 0 },
        { id: 'p2', contributed: 0, folded: false, allIn: false, stack: 100, streetContributed: 0 },
      ],
    }

    const pots = computePots(state as TableState)
    expect(pots).toHaveLength(0)
  })

  it('should handle single player contribution (everyone else folded)', () => {
    const state: Partial<TableState> = {
      seats: [
        { id: 'p1', contributed: 100, folded: false, allIn: false, stack: 0, streetContributed: 0 },
        { id: 'p2', contributed: 0, folded: true, allIn: false, stack: 0, streetContributed: 0 },
        { id: 'p3', contributed: 0, folded: true, allIn: false, stack: 0, streetContributed: 0 },
      ],
    }

    const pots = computePots(state as TableState)
    expect(pots).toHaveLength(1)
    expect(pots[0].amount).toBe(100)
    expect(pots[0].eligible).toEqual(['p1'])
  })

  it('should handle 3-player exact side pot with short stack all-in', () => {
    const state: Partial<TableState> = {
      seats: [
        { id: 'p1', contributed: 100, folded: false, allIn: true, stack: 0, streetContributed: 0 },  // Short stack all-in
        { id: 'p2', contributed: 300, folded: false, allIn: false, stack: 200, streetContributed: 0 },
        { id: 'p3', contributed: 300, folded: false, allIn: false, stack: 400, streetContributed: 0 },
      ],
    }

    const pots = computePots(state as TableState)
    expect(pots).toHaveLength(2)

    // Main pot: 100 * 3 = 300 (all three eligible)
    expect(pots[0].amount).toBe(300)
    expect(pots[0].eligible).toHaveLength(3)
    expect(pots[0].eligible).toContain('p1')
    expect(pots[0].eligible).toContain('p2')
    expect(pots[0].eligible).toContain('p3')

    // Side pot: 200 * 2 = 400 (only p2 and p3)
    expect(pots[1].amount).toBe(400)
    expect(pots[1].eligible).toHaveLength(2)
    expect(pots[1].eligible).toContain('p2')
    expect(pots[1].eligible).toContain('p3')
    expect(pots[1].eligible).not.toContain('p1')
  })

  it('should merge pots with same eligible players', () => {
    const state: Partial<TableState> = {
      seats: [
        { id: 'p1', contributed: 100, folded: false, allIn: false, stack: 0, streetContributed: 0 },
        { id: 'p2', contributed: 100, folded: false, allIn: false, stack: 0, streetContributed: 0 },
        { id: 'p3', contributed: 100, folded: true, allIn: false, stack: 0, streetContributed: 0 },  // Folded
      ],
    }

    const pots = computePots(state as TableState)
    // Should merge into single pot since p1 and p2 are both eligible for all money
    expect(pots).toHaveLength(1)
    expect(pots[0].amount).toBe(300)
    expect(pots[0].eligible).toEqual(['p1', 'p2'])
  })
})