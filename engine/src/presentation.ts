import type { GameState } from './types.js'
import {
  currentActorSeat,
  getBoard,
  getPhase,
  getPlayers,
  getPositions,
  getPotSize,
} from './selectors.js'
import { getSeed } from './rng.js'
import { computeWinningOdds } from './odds.js'
import type { OddsMethod } from './odds.js'

export interface PresentationRow {
  marker: string
  line: string
  odds?: PresentationRowOdds
}

export interface PresentationView {
  header: string
  board?: string
  pot?: number
  rows: PresentationRow[]
  footer?: string
}

export interface PresentationRowOdds {
  method: OddsMethod
  equity: number
  winProbability: number
  tieProbability: number
  trials: number
  considered: boolean
}

export function toPresentation(state: GameState): PresentationView {
  const phase = getPhase(state)
  const board = getBoard(state)
  const pot = getPotSize(state)
  const players = getPlayers(state)
  const positions = getPositions(state)
  const actor = currentActorSeat(state)
  const odds = computeWinningOdds(state)
  const oddsBySeatIndex = new Map(odds.map(entry => [entry.seatIndex, entry]))

  const rows: PresentationRow[] = players.map((player, index) => {
    const marker = actor === index ? '->' : '  '
    const hole = player.hole ? player.hole.join(' ') : '--'
    const position = positions[index]
    const positionTag = position ? `[${position}] ` : ''
    const flags = [player.folded ? 'folded' : '', player.allIn ? 'all-in' : '']
      .filter(Boolean)
      .join(', ')
    const status = flags ? ` (${flags})` : ''
    const oddsEntry = oddsBySeatIndex.get(index)
    const rowOdds =
      oddsEntry && oddsEntry.considered
        ? {
            method: oddsEntry.method,
            equity: oddsEntry.equity,
            winProbability: oddsEntry.winProbability,
            tieProbability: oddsEntry.tieProbability,
            trials: oddsEntry.trials,
            considered: true,
          }
        : oddsEntry
        ? {
            method: oddsEntry.method,
            equity: oddsEntry.equity,
            winProbability: oddsEntry.winProbability,
            tieProbability: oddsEntry.tieProbability,
            trials: oddsEntry.trials,
            considered: false,
          }
        : undefined

    return {
      marker,
      line: `${positionTag}${player.name} | stack: ${player.stack} | bet: ${player.bet} | hole: ${hole}${status}`,
      odds: rowOdds,
    }
  })

  const presentation: PresentationView = {
    header: `=== Phase: ${phase} ===`,
    rows,
  }

  if (board.length) {
    presentation.board = board.join(' ')
  }
  if (pot > 0) {
    presentation.pot = pot
  }
  const seed = getSeed(state)
  if (seed !== undefined) {
    presentation.footer = `RNG: ${seed}`
  }

  return presentation
}
