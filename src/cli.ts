#!/usr/bin/env node

import { createInterface } from 'readline'
import { PokerEngine, cardToAscii } from './engine.js'

function formatHandRank(rank: string): string {
  return rank.replace(/_/g, ' ')
}

function formatShowdownResult(engine: PokerEngine) {
  const result = engine.showdown()

  let output = '\n'

  result.results.forEach(({ player, eval: evalResult, hole }, index) => {
    const holeStr = hole.map(cardToAscii).join(' ')
    const best5Str = evalResult.best5.map(cardToAscii).join(',')
    const rankStr = formatHandRank(evalResult.rank)
    const foldedStr = engine.isFolded(player) ? ' (FOLDED)' : ''
    output += `P${player + 1}: ${holeStr}  ⇒  ${rankStr} (${best5Str})${foldedStr}\n`
  })

  if (result.winners.length === 1) {
    output += `\nWinner(s): P${result.winners[0] + 1}\n`
  } else {
    const winnerLabels = result.winners.map(w => `P${w + 1}`).join(',')
    output += `\nSplit: ${winnerLabels}\n`
  }

  return output
}

function formatStatus(engine: PokerEngine): string {
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

    const holeDisplay = status.holeCounts.map((count, i) => {
      const folded = status.foldedPlayers.includes(i + 1)
      if (folded) {
        return `P${i + 1}: FOLDED`
      }
      return count > 0 ? `P${i + 1}: ${count} cards` : `P${i + 1}: 0 cards`
    }).join(', ')
    output += `Hole: ${holeDisplay}\n`

    if (status.foldedPlayers.length > 0) {
      output += `Folded: P${status.foldedPlayers.join(', P')}\n`
    }
  } else {
    output += `Players: ${status.players}, Phase: ${status.phase}\n`
  }

  output += `Available: ${status.nextCmdHints.join(', ')}\n`

  return output
}

function showHelp(): string {
  return `
Commands:
  deal              - Deal new hand
  flop              - Deal flop (3 community cards)
  turn              - Deal turn (4th community card)
  river             - Deal river (5th community card)
  showdown          - Evaluate hands and determine winner(s)
  players <n>       - Set number of players (2-9, IDLE only)
  hole <player>     - Show hole cards for player (1-based, e.g. hole 1)
  fold <player>     - Fold player's hand (1-based, e.g. fold 1)
  status            - Show current game state
  help              - Show this help
  q                 - Quit

Advanced:
  seed <n>          - Set RNG seed for reproducible games
`
}

async function main() {
  const engine = new PokerEngine()
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
  })

  console.log('🃏 Poker Pocket CLI')
  console.log('Type "help" for commands')
  console.log(formatStatus(engine))

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
        case 'deal':
          engine.deal()
          console.log('Cards dealt!')
          console.log(formatStatus(engine))
          break

        case 'flop':
          engine.flop()
          console.log('Flop dealt!')
          console.log(formatStatus(engine))
          break

        case 'turn':
          engine.turn()
          console.log('Turn dealt!')
          console.log(formatStatus(engine))
          break

        case 'river':
          engine.river()
          console.log('River dealt!')
          console.log(formatStatus(engine))
          break

        case 'showdown':
          console.log(formatShowdownResult(engine))
          console.log(formatStatus(engine))
          break

        case 'players':
          if (args.length !== 1 || isNaN(Number(args[0]))) {
            console.log('Usage: players <number>')
            break
          }
          engine.setPlayers(Number(args[0]))
          console.log(`Players set to ${args[0]}`)
          console.log(formatStatus(engine))
          break

        case 'hole':
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

        case 'fold':
          if (args.length !== 1 || isNaN(Number(args[0]))) {
            console.log('Usage: fold <player> (e.g. fold 1)')
            break
          }
          const foldPlayerNum = Number(args[0])
          if (foldPlayerNum < 1 || foldPlayerNum > 9) {
            console.log('Player must be 1-9')
            break
          }
          try {
            engine.fold(foldPlayerNum - 1)
            console.log(`P${foldPlayerNum} folds`)

            // Check if someone wins by fold
            const winnerByFold = engine.getWinnerByFold()
            if (winnerByFold !== null) {
              console.log(`\nP${winnerByFold + 1} wins! (All other players folded)\n`)
            } else {
              console.log(formatStatus(engine))
            }
          } catch (error) {
            console.log(`Error: ${(error as Error).message}`)
          }
          break

        case 'seed':
          if (args.length !== 1 || isNaN(Number(args[0]))) {
            console.log('Usage: seed <number>')
            break
          }
          engine.setSeed(Number(args[0]))
          console.log(`Seed set to ${args[0]} for next deal`)
          break

        case 'status':
          console.log(formatStatus(engine))
          break

        case 'help':
          console.log(showHelp())
          break

        case 'q':
        case 'quit':
        case 'exit':
          console.log('Goodbye!')
          rl.close()
          process.exit(0)

        default:
          console.log(`Unknown command: ${cmd}`)
          console.log('Type "help" for available commands')
          console.log('\nQuick commands: deal, flop, turn, river, showdown, status, players <n>')
      }
    } catch (error) {
      console.log(`Error: ${(error as Error).message}`)
    }

    rl.prompt()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}