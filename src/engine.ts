import { Card, EvalResult } from './types.js'
import { LCG, RNG } from './rng.js'
import { createDeck, shuffle, draw } from './deck.js'
import { evaluateSeven } from './evaluator.js'

type Phase = 'IDLE' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'HAND_COMPLETE'

export interface ShowdownResult {
  results: { player: number; eval: EvalResult; hole: Card[] }[]
  winners: number[]
}

export interface EngineStatus {
  players: number
  phase: string
  boardAscii: string
  holeCounts: number[]
  foldedPlayers: number[]
  nextCmdHints: string[]
  lastShowdown?: {
    results: string
    winners: string
  }
}

export class PokerEngine {
  private players: number = 2
  private rng: RNG = new LCG()
  private deck: Card[] | null = null
  private hole: Card[][] = []
  private board: Card[] = []
  private phase: Phase = 'IDLE'
  private pendingSeed?: number
  private folded: boolean[] = []
  private lastShowdownResults?: string
  private lastShowdownWinners?: string
  setPlayers(n: number): void {
    if (this.phase !== 'IDLE' && this.phase !== 'HAND_COMPLETE') {
      throw new Error('Cannot change players mid-hand')
    }
    if (n < 2 || n > 9) {
      throw new Error('Players must be between 2 and 9')
    }
    this.players = n
  }

  setSeed(n: number): void {
    this.pendingSeed = n
  }

  deal(): void {
    if (this.pendingSeed !== undefined) {
      this.rng.seed(this.pendingSeed)
      this.pendingSeed = undefined
    }

    this.deck = createDeck()
    shuffle(this.deck, this.rng)
    this.hole = []
    this.board = []
    this.folded = Array(this.players).fill(false)

    for (let i = 0; i < this.players; i++) {
      this.hole.push(draw(this.deck, 2))
    }

    this.phase = 'PREFLOP'
  }

  flop(): void {
    if (this.phase !== 'PREFLOP') {
      throw new Error('Can only flop from preflop phase')
    }
    if (!this.deck) {
      throw new Error('No deck available')
    }

    draw(this.deck, 1)
    this.board.push(...draw(this.deck, 3))
    this.phase = 'FLOP'
  }

  turn(): void {
    if (this.phase !== 'FLOP') {
      throw new Error('Can only turn from flop phase')
    }
    if (!this.deck) {
      throw new Error('No deck available')
    }

    draw(this.deck, 1)
    this.board.push(...draw(this.deck, 1))
    this.phase = 'TURN'
  }

  river(): void {
    if (this.phase !== 'TURN') {
      throw new Error('Can only river from turn phase')
    }
    if (!this.deck) {
      throw new Error('No deck available')
    }

    draw(this.deck, 1)
    this.board.push(...draw(this.deck, 1))
    this.phase = 'RIVER'
  }

  showdown(): ShowdownResult {
    if (!['FLOP', 'TURN', 'RIVER'].includes(this.phase)) {
      throw new Error('Can only showdown from flop, turn, or river phase')
    }

    const results = this.hole.map((holeCards, player) => {
      const sevenCards = [...holeCards, ...this.board]
      const evalResult = evaluateSeven(sevenCards)
      return { player, eval: evalResult, hole: holeCards }
    })

    // Only consider non-folded players for winners
    const activeResults = results.filter((_, player) => !this.folded[player])

    if (activeResults.length === 0) {
      throw new Error('All players have folded')
    }

    const bestScore = Math.max(...activeResults.map(r => Number(r.eval.score)))
    const winners = activeResults
      .filter(r => Number(r.eval.score) === bestScore)
      .map(r => r.player)

    // Store results for display in HAND_COMPLETE phase
    this.lastShowdownResults = results.map(({ player, eval: evalResult, hole }) => {
      const holeStr = hole.map(cardToAscii).join(' ')
      const best5Str = evalResult.best5.map(cardToAscii).join(',')
      const rankStr = evalResult.rank.replace(/_/g, ' ')
      const foldedStr = this.folded[player] ? ' (FOLDED)' : ''
      return `P${player + 1}: ${holeStr}  ⇒  ${rankStr} (${best5Str})${foldedStr}`
    }).join('\n')

    if (winners.length === 1) {
      this.lastShowdownWinners = `Winner(s): P${winners[0] + 1}`
    } else {
      const winnerLabels = winners.map(w => `P${w + 1}`).join(',')
      this.lastShowdownWinners = `Split: ${winnerLabels}`
    }

    // Transition to HAND_COMPLETE phase
    this.phase = 'HAND_COMPLETE'

    return { results, winners }
  }

  fold(player: number): void {
    if (player < 0 || player >= this.players) {
      throw new Error(`Invalid player ${player}. Must be 0-${this.players - 1}`)
    }
    if (!['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(this.phase)) {
      throw new Error('Can only fold during a hand')
    }
    if (this.folded[player]) {
      throw new Error(`Player ${player + 1} has already folded`)
    }

    this.folded[player] = true
  }

  getActivePlayers(): number[] {
    return this.folded.map((folded, i) => folded ? null : i).filter(p => p !== null) as number[]
  }

  getWinnerByFold(): number | null {
    const activePlayers = this.getActivePlayers()
    return activePlayers.length === 1 ? activePlayers[0] : null
  }

  getHoleCards(player: number): Card[] {
    if (player < 0 || player >= this.players) {
      throw new Error(`Invalid player ${player}. Must be 0-${this.players - 1}`)
    }
    return this.hole[player] || []
  }

  isFolded(player: number): boolean {
    if (player < 0 || player >= this.players) {
      throw new Error(`Invalid player ${player}. Must be 0-${this.players - 1}`)
    }
    return this.folded[player] || false
  }

  status(): EngineStatus {
    const boardAscii = this.board.map(cardToAscii).join(' ')
    const holeCounts = this.hole.map(h => h.length)
    const foldedPlayers = this.folded.map((folded, i) => folded ? i + 1 : null).filter(p => p !== null) as number[]

    let nextCmdHints: string[] = []
    switch (this.phase) {
      case 'IDLE':
        nextCmdHints = ['deal', 'players <n>']
        break
      case 'PREFLOP':
        nextCmdHints = ['flop', 'fold <player>']
        break
      case 'FLOP':
        nextCmdHints = ['turn', 'showdown', 'fold <player>']
        break
      case 'TURN':
        nextCmdHints = ['river', 'showdown', 'fold <player>']
        break
      case 'RIVER':
        nextCmdHints = ['showdown', 'fold <player>']
        break
      case 'HAND_COMPLETE':
        nextCmdHints = ['deal (new hand)', 'players <n>']
        break
    }

    let lastShowdown
    if (this.phase === 'HAND_COMPLETE' && this.lastShowdownResults && this.lastShowdownWinners) {
      lastShowdown = {
        results: this.lastShowdownResults,
        winners: this.lastShowdownWinners
      }
    }

    return {
      players: this.players,
      phase: this.phase,
      boardAscii,
      holeCounts,
      foldedPlayers,
      nextCmdHints,
      lastShowdown
    }
  }
}

export function cardToAscii(card: Card): string {
  const suitSymbols: Record<string, string> = {
    's': '♠', 'h': '❤', 'd': '♦', 'c': '♣'
  }

  const useUnicode = process.env.DISABLE_UNICODE !== '1' && process.platform !== 'win32'
  const suitDisplay = useUnicode ? suitSymbols[card.suit] : card.suit

  return `${card.rank}${suitDisplay}`
}