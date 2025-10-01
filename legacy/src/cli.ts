#!/usr/bin/env node

import { createInterface, Interface as ReadlineInterface } from 'node:readline'
import { cardToAscii } from './engine.js'
import { evaluateSeven } from './evaluator.js'
import type { Card, EvalResult } from './types.js'
import {
  createTable,
  reduce,
  getLegalActions,
  computePots,
  type TableState,
  type TableConfig,
  type Action,
  type LegalActions,
} from './index.js'

const argv = process.argv.slice(2)
if (argv.includes('-h') || argv.includes('--help')) {
  console.log(showHelp())
  process.exit(0)
}

// Helper functions
function showHelp(): string {
  return `
Poker Pocket CLI - Interactive Texas Hold'em

Usage:
  pokerpocket         Start interactive game
  pokerpocket -h      Show this help

During gameplay:
  - Each player takes turns making decisions
  - You can choose to see hole cards or play blind
  - Actions: check, call, bet <amount>, raise <amount>, fold, allin
  - Type 'quit' to exit the game

The game will prompt you for:
  - Number of players (2-9)
  - Starting stack size
  - Big blind amount
`
}

async function askQuestion(
  rl: ReadlineInterface,
  question: string,
  validator?: (value: number) => boolean,
  errorMsg?: string,
  defaultValue?: number
): Promise<number> {
  return new Promise(resolve => {
    rl.question(question, answer => {
      if (!answer && defaultValue !== undefined) {
        resolve(defaultValue)
        return
      }

      const value = parseInt(answer)
      if (isNaN(value)) {
        console.log(errorMsg || 'Please enter a valid number')
        resolve(askQuestion(rl, question, validator, errorMsg, defaultValue))
        return
      }

      if (validator && !validator(value)) {
        console.log(errorMsg || 'Invalid value')
        resolve(askQuestion(rl, question, validator, errorMsg, defaultValue))
        return
      }

      resolve(value)
    })
  })
}

async function askYesNo(
  rl: ReadlineInterface,
  question: string
): Promise<boolean> {
  return new Promise(resolve => {
    rl.question(question, answer => {
      const normalized = answer.toLowerCase().trim()
      resolve(normalized === 'y' || normalized === 'yes')
    })
  })
}

async function askString(
  rl: ReadlineInterface,
  question: string
): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim())
    })
  })
}

function formatCard(card: Card): string {
  return cardToAscii(card)
}

function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(', ')
}

function getTotalPot(table: TableState): number {
  // Sum all contributions from players
  return table.seats.reduce((sum, seat) => sum + seat.contributed, 0)
}

function getPositionString(table: TableState, seatIndex: number): string {
  const positions: string[] = []

  if (seatIndex === table.button) positions.push('Dealer')
  if (seatIndex === table.sbIndex) positions.push('SB')
  if (seatIndex === table.bbIndex) positions.push('BB')

  // UTG position (first to act preflop after blinds)
  const activePlayers = table.seats.filter(
    s => s.id !== '' && s.stack > 0
  ).length
  if (activePlayers > 2 && table.street === 'PREFLOP') {
    const utgIndex = (table.bbIndex + 1) % table.config.maxSeats
    if (seatIndex === utgIndex) positions.push('UTG')
  }

  return positions.length > 0 ? ` - ${positions.join(', ')}` : ''
}

function getPostedInfo(seat: any): string {
  if (seat.streetContributed > 0) {
    return `, ${seat.streetContributed} posted`
  }
  return ''
}

function formatActions(actions: LegalActions, stack: number): string {
  const parts: string[] = []

  if (actions.canCheck) {
    parts.push('Check')
  }
  if (actions.canCall) {
    parts.push(`Call ${actions.callAmount}`)
  }
  if (actions.canBet) {
    parts.push(`Bet (min ${actions.minBet}, max ${stack})`)
  }
  if (actions.canRaise) {
    parts.push(`Raise (min ${actions.minRaiseTo}, max ${actions.maxRaiseTo})`)
  }
  if (actions.canFold) {
    parts.push('Fold')
  }

  return parts.join(', ')
}

function displayGameState(table: TableState) {
  // Show pot
  console.log(`Pot: ${getTotalPot(table)}`)

  // Show board if any
  if (table.board.length > 0) {
    console.log(`Board: [${table.board.map(formatCard).join(', ')}]`)
  }

  // Show player summaries
  console.log('Players:')
  table.seats.forEach((seat, i) => {
    if (seat.id === '') return

    // Format folded players differently
    if (seat.folded) {
      console.log(`  P${i + 1}: FOLDED`)
      return
    }

    let status = `  P${i + 1}: ${seat.stack} chips`

    // Show amount in pot this street if any
    if (seat.streetContributed > 0) {
      status += ` (${seat.streetContributed} in pot)`
    }

    // Show special statuses
    if (seat.allIn) status += ' [ALL-IN]'
    if (i === table.button) status += ' (D)'

    // Highlight next to act
    if (i === table.actionOn && table.street !== 'COMPLETE') {
      status += ' ← Next'
    }

    console.log(status)
  })
}

function isRoundComplete(table: TableState): boolean {
  // Check if all non-folded, non-allin players have acted
  const activePlayers = table.seats.filter(
    (s, i) => s.id !== '' && !s.folded && !s.allIn
  )

  if (activePlayers.length === 0) return true

  // Check if everyone has had a chance to act and amounts are equal
  for (const player of activePlayers) {
    if (player.streetContributed < table.currentBet) {
      return false
    }
  }

  // Make sure everyone has acted at least once
  return table.hasActedThisRound.size >= activePlayers.length
}

async function setupGame(rl: ReadlineInterface): Promise<TableState> {
  console.log('Welcome to Poker Pocket CLI!')

  const players = await askQuestion(
    rl,
    'How many players? ',
    n => n >= 2 && n <= 9,
    'Please enter 2-9'
  )

  const stack = await askQuestion(
    rl,
    'Starting stack (default 10,000)? ',
    n => n > 0,
    'Stack must be positive',
    10000
  )

  const bb = await askQuestion(
    rl,
    'Big blind amount (default 100)? ',
    n => n > 0,
    'Blind must be positive',
    100
  )

  console.log('\nShuffling deck... dealing hole cards...\n')

  // Create table
  let table = createTable({
    variant: 'NLHE',
    maxSeats: players,
    blinds: { sb: Math.floor(bb / 2), bb: bb },
  })

  // Add players
  for (let i = 0; i < players; i++) {
    table = reduce(table, {
      type: 'SIT',
      seat: i,
      buyin: stack,
      name: `Player ${i + 1}`,
    })
  }

  return table
}

async function getPlayerAction(
  rl: ReadlineInterface,
  table: TableState,
  actions: LegalActions
): Promise<Action> {
  while (true) {
    const input = await askString(rl, 'Your move: ')

    if (input === 'quit') {
      console.log('\nThanks for playing!')
      process.exit(0)
    }

    const [cmd, amountStr] = input.toLowerCase().split(/\s+/)

    switch (cmd) {
      case 'check':
        if (!actions.canCheck) {
          console.log('Cannot check - there is a bet to call')
          continue
        }
        return { type: 'CHECK', seat: table.actionOn }

      case 'call':
        if (!actions.canCall) {
          console.log('No bet to call')
          continue
        }
        return { type: 'CALL', seat: table.actionOn }

      case 'bet': {
        if (!actions.canBet) {
          console.log('Cannot bet - use raise instead')
          continue
        }
        const betAmount = parseInt(amountStr)
        if (isNaN(betAmount)) {
          console.log('Please specify amount: bet <amount>')
          continue
        }
        if (betAmount < actions.minBet) {
          console.log(`Minimum bet is ${actions.minBet}`)
          continue
        }
        const seat = table.seats[table.actionOn]
        if (betAmount > seat.stack) {
          console.log(`You only have ${seat.stack} chips`)
          continue
        }
        return { type: 'BET', seat: table.actionOn, to: betAmount }
      }

      case 'raise': {
        if (!actions.canRaise) {
          console.log('Cannot raise')
          continue
        }
        const raiseAmount = parseInt(amountStr)
        if (isNaN(raiseAmount)) {
          console.log('Please specify amount: raise <amount>')
          continue
        }
        if (raiseAmount < actions.minRaiseTo) {
          console.log(`Minimum raise is ${actions.minRaiseTo}`)
          continue
        }
        if (raiseAmount > actions.maxRaiseTo) {
          console.log(`Maximum raise is ${actions.maxRaiseTo}`)
          continue
        }
        return { type: 'RAISE', seat: table.actionOn, to: raiseAmount }
      }

      case 'fold':
        if (!actions.canFold) {
          console.log('Cannot fold')
          continue
        }
        return { type: 'FOLD', seat: table.actionOn }

      case 'allin':
      case 'all-in':
        return { type: 'ALL_IN', seat: table.actionOn }

      default:
        console.log(
          'Invalid action. Try: check, call, bet <amount>, raise <amount>, fold, allin'
        )
    }
  }
}

async function playerTurn(
  table: TableState,
  rl: ReadlineInterface
): Promise<TableState> {
  const seat = table.seats[table.actionOn]
  const seatNum = table.actionOn + 1

  // Show position info
  const position = getPositionString(table, table.actionOn)
  console.log(
    `\n(Player ${seatNum}${position}, Stack: ${seat.stack}${getPostedInfo(seat)})`
  )

  // Optional card reveal
  const showCards = await askYesNo(rl, 'See your hole cards? (y/n): ')
  if (showCards && seat.hole) {
    console.log(
      `→ Hole cards: [${formatCard(seat.hole[0])}, ${formatCard(seat.hole[1])}]`
    )
  }

  // Show legal actions
  const actions = getLegalActions(table, table.actionOn)
  const actionStr = formatActions(actions, seat.stack)
  console.log(`Actions: ${actionStr}`)

  // Get and validate action
  const move = await getPlayerAction(rl, table, actions)

  // Calculate call amount BEFORE applying action
  let actionDescription = ''
  switch (move.type) {
    case 'CHECK':
      actionDescription = 'checks'
      break
    case 'CALL':
      const callAmount = table.currentBet - seat.streetContributed
      actionDescription = `calls ${callAmount}`
      break
    case 'BET':
      actionDescription = `bets ${move.to}`
      break
    case 'RAISE':
      actionDescription = `raises to ${move.to}`
      break
    case 'FOLD':
      actionDescription = 'folds'
      break
    case 'ALL_IN':
      actionDescription = `goes all-in (${seat.stack})`
      break
    default:
      actionDescription = move.type.toLowerCase()
  }

  // Apply the action
  const newTable = reduce(table, move)

  // Confirm the action and show result
  console.log(`\n✓ Player ${seatNum} ${actionDescription}`)

  // Show updated game state after action
  displayGameState(newTable)

  return newTable
}

function displayHandStart(table: TableState) {
  const dealerNum = table.button + 1
  const sbNum = table.sbIndex + 1
  const bbNum = table.bbIndex + 1

  const sbSeat = table.seats[table.sbIndex]
  const bbSeat = table.seats[table.bbIndex]

  console.log(
    `Dealer: Player ${dealerNum}  |  Small Blind: Player ${sbNum} (${sbSeat.streetContributed})  |  Big Blind: Player ${bbNum} (${bbSeat.streetContributed})`
  )
  console.log(`Pot: ${getTotalPot(table)}`)
}

function displayStreetTransition(table: TableState) {
  const streetNames: Record<string, string> = {
    FLOP: '--- Flop ---',
    TURN: '--- Turn ---',
    RIVER: '--- River ---',
    SHOWDOWN: '--- Showdown ---',
  }

  console.log(`\n${streetNames[table.street] || table.street}`)

  // Display full game state for the new street
  displayGameState(table)
}

function evaluateHand(
  hole: [Card, Card],
  board: Card[]
): { rank: string; description: string } {
  const allCards = [...hole, ...board]
  const result = evaluateSeven(allCards)

  const rankDescriptions: Record<string, string> = {
    STRAIGHT_FLUSH: 'Straight Flush',
    FOUR_OF_A_KIND: 'Four of a Kind',
    FULL_HOUSE: 'Full House',
    FLUSH: 'Flush',
    STRAIGHT: 'Straight',
    THREE_OF_A_KIND: 'Three of a Kind',
    TWO_PAIR: 'Two Pair',
    ONE_PAIR: 'Pair',
    HIGH_CARD: 'High Card',
  }

  return {
    rank: result.rank,
    description: rankDescriptions[result.rank] || result.rank,
  }
}

function displayShowdown(table: TableState) {
  console.log('\n--- Showdown ---')

  // Show all remaining players' cards
  table.seats.forEach((seat, i) => {
    if (seat.id && !seat.folded && seat.hole) {
      const handEval = evaluateHand(seat.hole, table.board)
      console.log(
        `Player ${i + 1}: ${formatCard(seat.hole[0])} ${formatCard(seat.hole[1])} → ${handEval.description}`
      )
    }
  })

  // Show winners - calculate total pot from winners if contributions are cleared
  let totalPot = 0
  if (table.winners && table.winners.length > 0) {
    totalPot = table.winners.reduce((sum, w) => sum + w.amount, 0)
    console.log('')
    table.winners.forEach(w => {
      const seatIdx = table.seats.findIndex(s => s.id === w.seatId)
      console.log(`Winner: Player ${seatIdx + 1} (+${w.amount})`)
    })
  }

  // Show final stacks
  console.log('\n--- Hand Result ---')
  const stacks = table.seats
    .filter(s => s.id !== '')
    .map((s, i) => `P${i + 1}:${s.stack}`)
    .join('  ')
  console.log(`Stacks: ${stacks}`)
}

async function main() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  // Setup game
  let table = await setupGame(rl)

  // Game loop
  let handNum = 1
  let continuePlaying = true

  while (continuePlaying) {
    // Start hand
    console.log(`\n--- New Hand #${handNum} ---`)
    table = reduce(table, { type: 'START_HAND' })
    displayHandStart(table)

    // Play hand
    let lastStreet = table.street
    while (table.street !== 'COMPLETE') {
      // Play current street
      const prevStreet = table.street

      // Check if anyone can still act
      const activePlayersCanAct = table.seats.some(
        s => s.id !== '' && !s.folded && !s.allIn
      )

      if (!activePlayersCanAct && isRoundComplete(table)) {
        // All players are all-in and round is complete
        // The last action should have triggered street advancement via handleActionComplete
        // If we're still on the same street, something is wrong
        if (table.street === lastStreet) {
          console.log('\nAll players all-in! Running out remaining streets...')

          // Manually compute pots and advance street since no more actions are possible
          const { computePots, advanceStreet } = await import('./index.js')
          table = { ...table, pots: computePots(table) }
          table = advanceStreet(table)

          if (table.street !== 'COMPLETE' && table.street !== lastStreet) {
            displayStreetTransition(table)
          }
          lastStreet = table.street
        }
      } else {
        // Normal play - there are players who can act
        while (
          !isRoundComplete(table) &&
          table.street === prevStreet &&
          table.street !== 'COMPLETE'
        ) {
          table = await playerTurn(table, rl)

          // Check if hand ended early (everyone folded)
          if (table.street === 'COMPLETE') {
            break
          }
        }

        // Show street transition if not complete
        if (table.street !== 'COMPLETE' && table.street !== prevStreet) {
          displayStreetTransition(table)
          lastStreet = table.street
        }
      }
    }

    // Show results
    displayShowdown(table)

    // Continue?
    continuePlaying = await askYesNo(rl, '\nContinue? (y/n): ')
    handNum++
  }

  console.log('\nThanks for playing!')
  rl.close()
}

export { main } // for testing

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
