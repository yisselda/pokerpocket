import type { Action, Card } from './types.js'
import { parseCard, toAsciiCard } from './cards.js'

export interface FormatActionOptions {
  prefixSeat?: boolean
}

function normalizeCard(card: Card | string): Card {
  return typeof card === 'string' ? parseCard(card) : card
}

export function formatBoard(board: readonly (Card | string)[]): string {
  if (board.length === 0) return ''
  return board
    .map(card => toAsciiCard(normalizeCard(card)))
    .join(' ')
}

const chipFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

export function formatChips(amount: number): string {
  return chipFormatter.format(amount)
}

export function formatAction(
  action: Action,
  options: FormatActionOptions = {}
): string {
  const prefix = options.prefixSeat && action.type === 'PLAYER_ACTION'
    ? `P${action.seat + 1} `
    : ''

  switch (action.type) {
    case 'PLAYER_ACTION': {
      const base = `${action.move.toLowerCase()}`
      if (action.move === 'RAISE' && typeof action.amount === 'number') {
        return `${prefix}${base} to ${formatChips(action.amount)}`
      }
      return `${prefix}${base}`
    }
    case 'START':
      return 'start hand'
    case 'DEAL_CARDS':
      return 'deal hole cards'
    case 'ROUND_COMPLETE':
      return 'end betting round'
    case 'SHOWDOWN':
      return 'to showdown'
    case 'NEXT_HAND':
      return 'next hand'
  }
}
