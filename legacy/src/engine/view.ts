import { TableState } from './betting/types.js'

/**
 * Creates a view of the table state from a specific seat's perspective
 * Hides opponents' hole cards until showdown
 */
export function viewFor(
  state: TableState,
  viewerSeatIndex: number
): TableState {
  // TODO: Implement view hiding
  return state
}
