import { startHand, dealCards, toShowdown } from './actions.js'
import { reduce } from './reducer.js'
import type { Action, GameState, BettingPhase } from './types.js'

export type StateByTag<Tag extends GameState['tag']> = Extract<
  GameState,
  { tag: Tag }
> extends never
  ? Extract<GameState, { tag: BettingPhase }> & { tag: Tag }
  : Extract<GameState, { tag: Tag }>

export function expectState<Tag extends GameState['tag']>(
  state: GameState,
  tag: Tag
): StateByTag<Tag> {
  if (state.tag !== tag) {
    throw new Error(`expected ${tag}, got ${state.tag}`)
  }
  return state as StateByTag<Tag>
}

export interface FastForwardOptions {
  maxIterations?: number
}

export function fastForward(
  initial: GameState,
  options: FastForwardOptions = {}
): GameState {
  const limit = options.maxIterations ?? 100
  let iterations = 0
  let state = initial

  while (iterations < limit) {
    if (state.tag === 'INIT') {
      state = reduce(state, startHand())
      iterations++
      continue
    }
    if (state.tag === 'DEAL') {
      state = reduce(state, dealCards())
      iterations++
      continue
    }
    if (state.tag === 'SHOWDOWN') {
      state = reduce(state, toShowdown())
      iterations++
      continue
    }
    break
  }

  return state
}

export function withDeck<State extends GameState & { deck?: string[] }>(
  state: State,
  deck: readonly string[]
): State {
  if (!('deck' in state)) {
    throw new Error('state does not carry a deck')
  }
  return {
    ...state,
    deck: [...deck],
  }
}

export function applyActions(
  initial: GameState,
  actions: readonly Action[],
  options: FastForwardOptions = {}
): GameState {
  let state = initial
  for (const action of actions) {
    state = reduce(state, action)
    state = fastForward(state, options)
  }
  return state
}

export interface Snapshot {
  tag: GameState['tag']
  board: string[]
  players: Array<{
    id: number
    stack: number
    bet: number
    contributed: number
    folded: boolean
    allIn: boolean
    hole?: string[]
  }>
  pots: { amount: number }[]
  rng?: number
}

export function snapshot(state: GameState): Snapshot {
  return {
    tag: state.tag,
    board: 'board' in state && Array.isArray(state.board) ? [...state.board] : [],
    players:
      'players' in state
        ? state.players.map(player => ({
            id: player.id ?? 0,
            stack: player.stack,
            bet: player.bet,
            contributed: player.contributed,
            folded: player.folded,
            allIn: player.allIn,
            hole: player.hole ? [...player.hole] : undefined,
          }))
        : [],
    pots:
      'pots' in state && Array.isArray(state.pots)
        ? state.pots.map(p => ({ amount: p.amount }))
        : [],
    rng: 'rng' in state && state.rng ? state.rng.getState() : undefined,
  }
}
