import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import { PokerEngine } from '../src/engine.js'
import { Card } from '../src/types.js'

function getAllDealtCards(engine: PokerEngine): Card[] {
  const status = engine.status()
  const allCards: Card[] = []

  // Get all hole cards from all players
  for (let player = 0; player < status.players; player++) {
    const holeCards = engine.getHoleCards(player)
    allCards.push(...holeCards)
  }

  // Get board cards (extract from boardAscii)
  if (status.boardAscii) {
    // Parse board cards from ASCII representation
    const boardCards = status.boardAscii.split(' ').map(cardStr => {
      const rank = cardStr.slice(0, -1) as Card['rank']
      let suit: Card['suit']
      const lastChar = cardStr.slice(-1)
      switch (lastChar) {
        case '♠': suit = 's'; break
        case '❤': suit = 'h'; break
        case '♦': suit = 'd'; break
        case '♣': suit = 'c'; break
        default: throw new Error(`Unknown suit symbol: ${lastChar}`)
      }
      return { rank, suit }
    })
    allCards.push(...boardCards)
  }

  return allCards
}

function cardEquals(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit
}

function hasDuplicates(cards: Card[]): boolean {
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cardEquals(cards[i], cards[j])) {
        return true
      }
    }
  }
  return false
}

function cardInArray(card: Card, cards: Card[]): boolean {
  return cards.some(c => cardEquals(c, card))
}

describe('Property-based tests', () => {
  it('no duplicate cards anywhere in the game', () => {
    fc.assert(fc.property(
      fc.integer({ min: 2, max: 9 }),  // number of players
      fc.integer({ min: 0, max: 2147483647 }),  // seed
      fc.constantFrom('FLOP', 'TURN', 'RIVER'),  // phase to advance to
      (players, seed, targetPhase) => {
        const engine = new PokerEngine()
        engine.setPlayers(players)
        engine.setSeed(seed)
        engine.deal()

        // Advance to target phase
        if (targetPhase === 'FLOP' || targetPhase === 'TURN' || targetPhase === 'RIVER') {
          engine.flop()
        }
        if (targetPhase === 'TURN' || targetPhase === 'RIVER') {
          engine.turn()
        }
        if (targetPhase === 'RIVER') {
          engine.river()
        }

        const allCards = getAllDealtCards(engine)
        return !hasDuplicates(allCards)
      }
    ), { numRuns: 100 })
  })

  it('best5 cards come from available cards for each player', () => {
    fc.assert(fc.property(
      fc.integer({ min: 2, max: 9 }),  // number of players
      fc.integer({ min: 0, max: 2147483647 }),  // seed
      fc.constantFrom('FLOP', 'TURN', 'RIVER'),  // phase for showdown
      (players, seed, targetPhase) => {
        const engine = new PokerEngine()
        engine.setPlayers(players)
        engine.setSeed(seed)
        engine.deal()

        // Advance to target phase
        if (targetPhase === 'FLOP' || targetPhase === 'TURN' || targetPhase === 'RIVER') {
          engine.flop()
        }
        if (targetPhase === 'TURN' || targetPhase === 'RIVER') {
          engine.turn()
        }
        if (targetPhase === 'RIVER') {
          engine.river()
        }

        const showdownResult = engine.showdown()
        const status = engine.status()

        // For each player, verify their best5 cards come from their available cards
        return showdownResult.results.every(({ player, eval: evalResult }) => {
          const holeCards = engine.getHoleCards(player)
          const boardCards = getAllDealtCards(engine).slice(players * 2) // Board cards come after hole cards
          const availableCards = [...holeCards, ...boardCards]

          // Every card in best5 must be in the player's available cards
          return evalResult.best5.every(card => cardInArray(card, availableCards))
        })
      }
    ), { numRuns: 100 })
  })
})