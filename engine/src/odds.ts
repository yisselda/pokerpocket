import { evaluateCards } from './evaluator.js'
import { LcgRng, getSeed } from './rng.js'
import { getBoard, getPlayers } from './selectors.js'
import type { GameState } from './types.js'

export type OddsMethod = 'settled' | 'exact' | 'monteCarlo'

export interface PlayerOdds {
  seatIndex: number
  seatId: number
  considered: boolean
  equity: number
  winProbability: number
  tieProbability: number
  trials: number
  method: OddsMethod
}

export interface ComputeOddsOptions {
  exactComboLimit?: number
  monteCarloSamples?: number
}

const DEFAULT_EXACT_COMBO_LIMIT = 100_000
const DEFAULT_MONTE_CARLO_SAMPLES = 20_000
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
const SUITS = ['s', 'h', 'd', 'c']

function buildDeck(): string[] {
  const deck: string[] = []
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(`${rank}${suit}`)
    }
  }
  return deck
}

function combinationCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  let result = 1
  let denom = 1
  for (let i = 0; i < k; i++) {
    result *= n - i
    denom *= i + 1
  }
  return result / denom
}

function enumerateCombinations<T>(
  items: readonly T[],
  select: number,
  cb: (combo: T[]) => void
) {
  if (select === 0) {
    cb([])
    return
  }
  const n = items.length
  const indices = Array.from({ length: select }, (_, i) => i)

  while (true) {
    cb(indices.map(i => items[i]))
    let i = select - 1
    while (i >= 0 && indices[i] === n - select + i) i--
    if (i < 0) break
    indices[i]++
    for (let j = i + 1; j < select; j++) {
      indices[j] = indices[j - 1] + 1
    }
  }
}

function pickRandomCombination<T>(
  items: readonly T[],
  select: number,
  rng: LcgRng
): T[] {
  if (select === 0) return []
  const pool = [...items]
  for (let i = 0; i < select; i++) {
    const remaining = pool.length - i
    const j = i + Math.floor(rng.next() * remaining)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, select)
}

export function computeWinningOdds(
  state: GameState,
  options: ComputeOddsOptions = {}
): PlayerOdds[] {
  const players = getPlayers(state)
  const board = getBoard(state)
  const knownCards = new Set(board)
  players.forEach(player => {
    if (Array.isArray(player.hole)) {
      player.hole.forEach(card => knownCards.add(card))
    }
  })

  const deck = buildDeck()
  const remainingDeck = deck.filter(card => !knownCards.has(card))
  const needed = Math.max(0, 5 - board.length)
  const exactLimit = options.exactComboLimit ?? DEFAULT_EXACT_COMBO_LIMIT
  const monteCarloSamples =
    options.monteCarloSamples ?? DEFAULT_MONTE_CARLO_SAMPLES

  const odds: PlayerOdds[] = players.map((player, index) => ({
    seatIndex: index,
    seatId: player.id ?? index,
    considered: false,
    equity: 0,
    winProbability: 0,
    tieProbability: 0,
    trials: 0,
    method: needed === 0 ? 'settled' : 'exact',
  }))

  if (state.tag === 'COMPLETE') {
    const winners = Array.isArray(state.winners) ? state.winners : []
    const winnerIds = new Set(winners.map(w => w.seatId))
    const multiple = winnerIds.size > 1
    odds.forEach(entry => {
      const isWinner = winnerIds.has(entry.seatId)
      entry.considered = isWinner || !!players[entry.seatIndex]?.hole
      entry.equity = isWinner ? 1 : 0
      entry.winProbability = isWinner && !multiple ? 1 : 0
      entry.tieProbability = isWinner && multiple ? 1 : 0
      entry.trials = 1
      entry.method = 'settled'
    })
    return odds
  }

  const eligibleSeats = players
    .map((player, index) => ({ player, index }))
    .filter(
      ({ player }) =>
        !player.folded && Array.isArray(player.hole) && player.hole.length === 2
    )

  eligibleSeats.forEach(({ index }) => {
    odds[index].considered = true
  })

  if (eligibleSeats.length <= 1) {
    if (eligibleSeats.length === 1) {
      const seatIndex = eligibleSeats[0].index
      const target = odds[seatIndex]
      target.equity = 1
      target.winProbability = 1
      target.trials = 1
      target.method = 'settled'
    }
    return odds
  }

  let totalTrials = 0
  const evaluateScenario = (extraBoard: readonly string[]) => {
    const fullBoard = board.concat(extraBoard)
    const evaluations = eligibleSeats.map(({ player, index }) => ({
      seatIndex: index,
      result: evaluateCards([...fullBoard, player.hole![0], player.hole![1]]),
    }))

    let bestScore = -Infinity
    evaluations.forEach(({ result }) => {
      if (result.score > bestScore) bestScore = result.score
    })

    const winners = evaluations
      .filter(({ result }) => result.score === bestScore)
      .map(entry => entry.seatIndex)

    if (winners.length === 0) return

    totalTrials += 1
    const share = 1 / winners.length
    winners.forEach(seatIndex => {
      const target = odds[seatIndex]
      target.equity += share
      if (winners.length === 1) {
        target.winProbability += 1
      } else {
        target.tieProbability += 1
      }
    })
  }

  if (needed === 0) {
    evaluateScenario([])
    odds.forEach(target => {
      if (!target.considered) return
      target.method = 'settled'
      target.trials = totalTrials
      if (totalTrials > 0) {
        target.winProbability /= totalTrials
        target.tieProbability /= totalTrials
        target.equity /= totalTrials
      }
    })
    return odds
  }

  const combos = combinationCount(remainingDeck.length, needed)
  const useExact = combos > 0 && combos <= exactLimit

  if (useExact) {
    enumerateCombinations(remainingDeck, needed, combo => {
      evaluateScenario(combo)
    })
    odds.forEach(target => {
      if (!target.considered) return
      target.method = 'exact'
      target.trials = totalTrials
      if (totalTrials > 0) {
        target.winProbability /= totalTrials
        target.tieProbability /= totalTrials
        target.equity /= totalTrials
      }
    })
    return odds
  }

  const seed = getSeed(state)
  const rng = new LcgRng(
    typeof seed === 'number'
      ? seed >>> 0
      : Math.floor(Math.random() * 0xffffffff)
  )
  const samples = Math.max(1, monteCarloSamples)
  for (let i = 0; i < samples; i++) {
    const combo = pickRandomCombination(remainingDeck, needed, rng)
    evaluateScenario(combo)
  }
  odds.forEach(target => {
    if (!target.considered) return
    target.method = 'monteCarlo'
    target.trials = totalTrials
    if (totalTrials > 0) {
      target.winProbability /= totalTrials
      target.tieProbability /= totalTrials
      target.equity /= totalTrials
    }
  })
  return odds
}
