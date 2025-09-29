import { TableState } from './types.js'

/**
 * Helper selectors for UI ergonomics
 */
export const selectors = {
  toCall(state: TableState, seat: number): number {
    // TODO: Implement
    return 0
  },

  isRoundClosed(state: TableState): boolean {
    // TODO: Implement
    return false
  },

  nextToAct(state: TableState): number | null {
    // TODO: Implement
    return null
  },

  minRaiseTo(state: TableState): number {
    // TODO: Implement
    return 0
  },
}