#!/usr/bin/env node

import { createInterface } from 'node:readline'
import { PokerEngine, cardToAscii } from './engine.js'
import * as betting from './betting.js'

const argv = process.argv.slice(2)
if (argv.includes('-h') || argv.includes('--help')) {
  console.log(showHelp())
  process.exit(0)
}

function formatStoredShowdownResult(engine: PokerEngine) {
  const status = engine.status()

  if (status.lastShowdown) {
    return `\n${status.lastShowdown.results}\n\n${status.lastShowdown.winners}\n`
  }

  return '\nNo showdown results available\n'
}

function formatStatus(
  engine: PokerEngine,
  bettingState: betting.BettingState,
  defaultStack: number = 10000
): string {
  const status = engine.status()
  let output = ''

  if (status.phase === 'HAND_COMPLETE') {
    output += `Hand complete!\n`

    if (status.lastShowdown) {
      output += `\n${status.lastShowdown.results}\n\n`
      output += `${status.lastShowdown.winners}\n\n`
    }

    if (status.boardAscii) {
      output += `Board: ${status.boardAscii}\n`
    }
  } else if (status.phase !== 'IDLE') {
    output += `Players: ${status.players}, Phase: ${status.phase}\n`

    if (status.boardAscii) {
      output += `Board: ${status.boardAscii}\n`
    }

    // Show betting information
    output += `\n💰 Pot: ${betting.getTotalPot(bettingState)}`
    if (bettingState.currentBet > 0) {
      output += ` | Current bet: ${bettingState.currentBet}`
    }
    output += '\n'

    // Show player stacks and status
    output += 'Players:\n'
    for (let i = 0; i < status.players; i++) {
      const p = bettingState.players[i] || {
        stack: defaultStack,
        committed: 0,
        hasFolded: false,
        isAllIn: false,
      }
      const isButton = i === bettingState.buttonIndex
      const isActing =
        i === bettingState.actingIndex && !betting.isRoundComplete(bettingState)
      const folded = p.hasFolded || status.foldedPlayers.includes(i + 1)

      let playerStr = `  P${i + 1}`
      if (isButton) playerStr += ' (D)'
      playerStr += `: ${p.stack} chips`

      if (p.committed > 0) playerStr += ` [${p.committed} in pot]`
      if (folded) playerStr += ' FOLDED'
      if (p.isAllIn) playerStr += ' ALL-IN'
      if (isActing) playerStr += ' ← TO ACT'

      output += playerStr + '\n'
    }
  } else {
    output += `Players: ${status.players}, Phase: ${status.phase}\n`
  }

  // Show available commands based on betting state
  if (status.phase !== 'IDLE' && !betting.isRoundComplete(bettingState)) {
    const actingPlayer = bettingState.actingIndex
    const legalActions = betting.legalActions(bettingState, actingPlayer)
    const actionStrings = legalActions.map(a => {
      if (a.type === 'bet' || a.type === 'raise') {
        return `${a.type} <amount> (${a.min}-${a.max})`
      }
      return a.type
    })
    output += `P${actingPlayer + 1} actions: ${actionStrings.join(', ')}\n`
  } else {
    output += `Available: ${status.nextCmdHints.join(', ')}\n`
  }

  return output
}

function showHelp(): string {
  return `
Commands:
  deal              - Deal new hand (with betting if enabled)
  flop              - Deal flop (3 community cards)
  turn              - Deal turn (4th community card)
  river             - Deal river (5th community card)
  showdown          - Evaluate hands and determine winner(s)
  players <n>       - Set number of players (2-9, IDLE only)
  hole <player>     - Show hole cards for player (1-based, e.g. hole 1)
  status            - Show current game state
  help              - Show this help
  q                 - Quit

Betting Commands:
  check             - Check (when no bet to call)
  call              - Call the current bet
  bet <amount>      - Bet specified amount (when no current bet)
  raise <amount>    - Raise by specified amount
  fold              - Fold your hand
  allin             - Go all-in with remaining chips

Betting Config:
  blinds <sb> <bb>  - Set small and big blind amounts
  ante <amount>     - Set ante amount (0 for none)
  stacks <amount>   - Set default starting stack
  button <player>   - Set dealer button position (0-based)

Advanced:
  seed <n>          - Set RNG seed for reproducible games
`
}

async function main() {
  const engine = new PokerEngine()
  let bettingState: betting.BettingState
  const bettingConfig: betting.TableConfig = {
    smallBlind: 50,
    bigBlind: 100,
    ante: 0,
  }
  let defaultStack = 10000
  let buttonIndex = 0

  // Initialize with default empty state
  bettingState = betting.initBettingWithDefaults(2, buttonIndex, defaultStack)

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  })

  let hasQuit = false
  const quit = () => {
    if (hasQuit) return
    hasQuit = true
    console.log('Goodbye!')
    rl.close() // ends the async iterator, triggers 'close'
  }
  rl.on('SIGINT', quit) // Ctrl-C inside readline
  rl.on('close', () => {
    // EOF / Ctrl-D OR after quit()
    if (!hasQuit) {
      // No 'q' processed (e.g. last line had no trailing \n) → still say goodbye
      console.log('Goodbye!')
    }
    process.exit(0)
  })

  console.log('🃏 Poker Pocket CLI')
  console.log('Type "help" for commands')
  console.log('Betting: ON | Blinds: 50/100 | Default stack: 10000')
  console.log(formatStatus(engine, bettingState, defaultStack))

  rl.prompt()

  for await (const line of rl) {
    const input = line.trim()

    if (!input) {
      rl.prompt()
      continue
    }

    // Handle extremely long input gracefully
    if (input.length > 10000) {
      console.log('Input too long. Type "help" for available commands')
      rl.prompt()
      continue
    }

    const [cmd, ...args] = input.toLowerCase().split(/\s+/)

    try {
      switch (cmd) {
        case 'deal': {
          engine.deal()

          // Initialize betting for this hand
          const playerCount = engine.status().players
          bettingState = betting.initBettingWithDefaults(
            playerCount,
            buttonIndex,
            defaultStack
          )
          bettingState = betting.postBlinds(bettingState, bettingConfig)

          console.log('Cards dealt! Blinds posted.')
          console.log(formatStatus(engine, bettingState, defaultStack))

          // Move button for next hand
          buttonIndex = (buttonIndex + 1) % playerCount
          break
        }

        case 'flop':
          // Check if betting round is complete
          if (!betting.isRoundComplete(bettingState)) {
            console.log('Complete the betting round first!')
            break
          }

          engine.flop()
          bettingState = betting.startNewRound(bettingState)

          console.log('Flop dealt!')
          console.log(formatStatus(engine, bettingState, defaultStack))
          break

        case 'turn':
          // Check if betting round is complete
          if (!betting.isRoundComplete(bettingState)) {
            console.log('Complete the betting round first!')
            break
          }

          engine.turn()
          bettingState = betting.startNewRound(bettingState)

          console.log('Turn dealt!')
          console.log(formatStatus(engine, bettingState, defaultStack))
          break

        case 'river':
          // Check if betting round is complete
          if (!betting.isRoundComplete(bettingState)) {
            console.log('Complete the betting round first!')
            break
          }

          engine.river()
          bettingState = betting.startNewRound(bettingState)

          console.log('River dealt!')
          console.log(formatStatus(engine, bettingState, defaultStack))
          break

        case 'showdown': {
          // Check if betting round is complete
          if (!betting.isRoundComplete(bettingState)) {
            console.log('Complete the betting round first!')
            break
          }

          // Call showdown once and use the result for both display and distribution
          const showdownResult = engine.showdown()
          console.log(formatStoredShowdownResult(engine))

          // Handle pot distribution
          const distribution = betting.distributePots(
            bettingState,
            showdownResult.winners
          )

          console.log('\n💰 Pot Distribution:')
          for (const dist of distribution) {
            console.log(`  P${dist.player + 1} wins ${dist.amount} chips`)
          }

          // Update stacks with winnings
          for (const dist of distribution) {
            bettingState.players[dist.player].stack += dist.amount
          }

          console.log('\nFinal Stacks:')
          for (let i = 0; i < bettingState.players.length; i++) {
            console.log(`  P${i + 1}: ${bettingState.players[i].stack} chips`)
          }

          console.log(formatStatus(engine, bettingState, defaultStack))
          break
        }

        case 'players': {
          if (args.length !== 1 || isNaN(Number(args[0]))) {
            console.log('Usage: players <number>')
            break
          }
          engine.setPlayers(Number(args[0]))

          // Reinitialize betting state for new player count
          const newPlayerCount = Number(args[0])
          bettingState = betting.initBettingWithDefaults(
            newPlayerCount,
            buttonIndex,
            defaultStack
          )

          console.log(`Players set to ${args[0]}`)
          console.log(formatStatus(engine, bettingState, defaultStack))
          break
        }

        case 'hole': {
          if (args.length !== 1 || isNaN(Number(args[0]))) {
            console.log('Usage: hole <player> (e.g. hole 1)')
            break
          }
          const playerNum = Number(args[0])
          if (playerNum < 1 || playerNum > 9) {
            console.log('Player must be 1-9')
            break
          }
          try {
            const holeCards = engine.getHoleCards(playerNum - 1)
            if (holeCards.length === 0) {
              console.log(`P${playerNum}: No cards dealt yet`)
            } else if (engine.isFolded(playerNum - 1)) {
              console.log(`P${playerNum}: FOLDED`)
            } else {
              const cardsStr = holeCards.map(cardToAscii).join(' ')
              console.log(`P${playerNum}: ${cardsStr}`)
            }
          } catch (error) {
            console.log(`Error: ${(error as Error).message}`)
          }
          break
        }

        case 'check':
        case 'call':
        case 'fold':
        case 'allin': {
          if (!betting.isRoundComplete(bettingState)) {
            const actingPlayer = bettingState.actingIndex
            try {
              bettingState = betting.applyAction(bettingState, {
                player: actingPlayer,
                type: cmd as betting.BetType,
              })

              if (cmd === 'fold') {
                engine.fold(actingPlayer)
              }

              console.log(`P${actingPlayer + 1} ${cmd}s`)

              // Check if someone wins by fold
              if (cmd === 'fold') {
                const activePlayers = betting.getActivePlayers(bettingState)
                if (activePlayers.length === 1) {
                  console.log(`\nP${activePlayers[0] + 1} wins the pot!\n`)

                  // Award pot to winner
                  const pots = betting.buildPots(bettingState.players)
                  const totalPot = pots.reduce(
                    (sum, pot) => sum + pot.amount,
                    0
                  )
                  bettingState.players[activePlayers[0]].stack += totalPot
                }
              }

              console.log(formatStatus(engine, bettingState, defaultStack))
            } catch (error) {
              console.log(`Error: ${(error as Error).message}`)
            }
          } else {
            console.log('No active betting round')
          }
          break
        }

        case 'bet':
        case 'raise': {
          if (!betting.isRoundComplete(bettingState)) {
            if (args.length !== 1 || isNaN(Number(args[0]))) {
              console.log(`Usage: ${cmd} <amount>`)
              break
            }

            const actingPlayer = bettingState.actingIndex
            const amount = Number(args[0])

            try {
              bettingState = betting.applyAction(bettingState, {
                player: actingPlayer,
                type: cmd as betting.BetType,
                amount: amount,
              })

              console.log(`P${actingPlayer + 1} ${cmd}s ${amount}`)
              console.log(formatStatus(engine, bettingState, defaultStack))
            } catch (error) {
              console.log(`Error: ${(error as Error).message}`)
            }
          } else {
            console.log('No active betting round')
          }
          break
        }

        case 'blinds':
          if (
            args.length !== 2 ||
            isNaN(Number(args[0])) ||
            isNaN(Number(args[1]))
          ) {
            console.log('Usage: blinds <small> <big>')
            break
          }
          bettingConfig.smallBlind = Number(args[0])
          bettingConfig.bigBlind = Number(args[1])
          console.log(`Blinds set to ${args[0]}/${args[1]}`)
          break

        case 'ante':
          if (args.length !== 1 || isNaN(Number(args[0]))) {
            console.log('Usage: ante <amount>')
            break
          }
          bettingConfig.ante = Number(args[0])
          console.log(`Ante set to ${args[0]}`)
          break

        case 'stacks':
          if (args.length !== 1 || isNaN(Number(args[0]))) {
            console.log('Usage: stacks <amount>')
            break
          }
          defaultStack = Number(args[0])
          console.log(`Default stack set to ${args[0]}`)
          break

        case 'button': {
          if (args.length !== 1 || isNaN(Number(args[0]))) {
            console.log('Usage: button <player> (0-based)')
            break
          }
          const buttonPlayer = Number(args[0])
          if (buttonPlayer < 0 || buttonPlayer >= engine.status().players) {
            console.log(`Button must be 0-${engine.status().players - 1}`)
            break
          }
          buttonIndex = buttonPlayer
          console.log(`Button set to P${buttonPlayer + 1}`)
          break
        }

        case 'seed':
          if (args.length !== 1 || isNaN(Number(args[0]))) {
            console.log('Usage: seed <number>')
            break
          }
          engine.setSeed(Number(args[0]))
          console.log(`Seed set to ${args[0]} for next deal`)
          break

        case 'skipbet':
          // Auto-complete betting round for testing purposes
          if (!betting.isRoundComplete(bettingState)) {
            // Make all players check/call to complete the round
            while (!betting.isRoundComplete(bettingState)) {
              const actingPlayer = bettingState.actingIndex
              const legalActions = betting.legalActions(
                bettingState,
                actingPlayer
              )

              // Choose the safest action (check if possible, otherwise call)
              let action: betting.Action
              if (legalActions.some(a => a.type === 'check')) {
                action = { player: actingPlayer, type: 'check' }
              } else if (legalActions.some(a => a.type === 'call')) {
                action = { player: actingPlayer, type: 'call' }
              } else {
                // Default to fold if can't check or call
                action = { player: actingPlayer, type: 'fold' }
                engine.fold(actingPlayer)
              }

              bettingState = betting.applyAction(bettingState, action)
            }
            console.log('Betting round auto-completed')
          } else {
            console.log('No active betting round')
          }
          break

        case 'status':
          console.log(formatStatus(engine, bettingState, defaultStack))
          break

        case 'help':
          console.log(showHelp())
          break

        case 'q':
        case 'quit':
        case 'exit':
          quit()
          break

        default:
          console.log(`Unknown command: ${cmd}`)
          console.log('Type "help" for available commands')
          console.log(
            '\nQuick commands: deal, flop, turn, river, showdown, status, players <n>'
          )
      }
    } catch (error) {
      console.log(`Error: ${(error as Error).message}`)
    }

    rl.prompt()
  }
}

export { main } // handy for tests: import { main } from '../dist/cli.js'

main().catch(err => {
  console.error(err)
  process.exit(1)
})
