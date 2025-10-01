import type { GameState, BettingPhase } from '../../src/types'

type StateByTag<Tag extends GameState['tag']> =
  Extract<GameState, { tag: Tag }> extends never
    ? Extract<GameState, { tag: BettingPhase }> & { tag: Tag }
    : Extract<GameState, { tag: Tag }>

export function expectState<Tag extends GameState['tag']>(
  state: GameState,
  tag: Tag
): StateByTag<Tag> {
  if (state.tag !== tag) throw new Error(`expected ${tag}, got ${state.tag}`)
  return state as StateByTag<Tag>
}
