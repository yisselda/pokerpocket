// PokerPocket Demo Application
// Imports from the PokerPocket engine
import { newGame, evaluate7, drawRandom, betting } from 'pokerpocket'

// Application State
let selectedCards = []

// Global function exports for HTML onclick handlers
window.playQuickGame = playQuickGame
window.addCard = addCard
window.addRandomCards = addRandomCards
window.clearCards = clearCards
window.evaluateHand = evaluateHand
window.runBenchmark = runBenchmark
window.removeCard = removeCard
window.dealLiveHand = dealLiveHand
window.resetLiveDemo = resetLiveDemo
window.copyQuickStart = copyQuickStart

function playQuickGame() {
  const players = parseInt(document.getElementById('players').value) || 3
  const seedInput = document.getElementById('seed').value
  const seed = seedInput
    ? parseInt(seedInput)
    : Math.floor(Math.random() * 10000)

  try {
    // Create game
    const game = newGame({ players, seed })

    // Play full hand
    game.deal()
    game.flop()
    game.turn()
    game.river()
    const result = game.showdown()

    // Format results with minimalist styling
    const status = game.status()
    let output = `SEED ${seed} • ${players} PLAYERS\n\n`
    output += `BOARD\n${status.boardAscii}\n\n`

    output += `RESULTS\n`
    result.results.forEach(({ player, eval: evalResult, hole }) => {
      const holeStr = hole.map(cardToString).join(' ')
      const handRank = evalResult.rank.replace(/_/g, ' ')
      const winner = result.winners.includes(player) ? ' ◦' : ''
      const playerLabel = `P${player + 1}`.padEnd(3)
      output += `${playerLabel} ${holeStr.padEnd(8)} ${handRank}${winner}\n`
    })

    if (result.winners.length === 1) {
      output += `\nWINNER: P${result.winners[0] + 1}`
    } else {
      const winnerList = result.winners.map((w) => `P${w + 1}`).join(' ')
      output += `\nTIE: ${winnerList}`
    }

    document.getElementById('gameResult').textContent = output
  } catch (error) {
    document.getElementById('gameResult').textContent =
      `Error: ${error.message}`
  }
}

function addCard() {
  if (selectedCards.length >= 7) {
    alert('Maximum 7 cards')
    return
  }

  const rank = document.getElementById('cardRank').value
  const suit = document.getElementById('cardSuit').value
  const newCard = { rank, suit }

  // Check duplicates
  if (
    selectedCards.some(
      (card) => card.rank === newCard.rank && card.suit === newCard.suit
    )
  ) {
    alert('Card already selected')
    return
  }

  selectedCards.push(newCard)
  updateCardDisplay()

  document.getElementById('evalBtn').disabled = selectedCards.length < 5
}

function addRandomCards() {
  clearCards()
  const numCards = 5 + Math.floor(Math.random() * 3) // 5-7 cards
  selectedCards = drawRandom(numCards)
  updateCardDisplay()
  document.getElementById('evalBtn').disabled = false
}

function clearCards() {
  selectedCards = []
  updateCardDisplay()
  document.getElementById('evalBtn').disabled = true
  document.getElementById('evalResult').textContent =
    'Add 5-7 cards to evaluate'
}

function updateCardDisplay() {
  const container = document.getElementById('cards')

  // Show selected cards
  const cardElements = selectedCards.map(
    (card, i) =>
      `<div class="card ${getSuitColor(card.suit)}" onclick="removeCard(${i})" title="Click to remove">
            ${cardToString(card)}
        </div>`
  )

  // Add face-down placeholders for empty slots (up to 7 total)
  const placeholderCount = Math.max(0, 7 - selectedCards.length)
  for (let i = 0; i < placeholderCount; i++) {
    cardElements.push(
      `<div class="card placeholder" title="Add cards using the controls above">🂠</div>`
    )
  }

  container.innerHTML = cardElements.join('')
}

function removeCard(index) {
  selectedCards.splice(index, 1)
  updateCardDisplay()
  document.getElementById('evalBtn').disabled = selectedCards.length < 5
}

function evaluateHand() {
  if (selectedCards.length < 5) return

  try {
    const result = evaluate7(selectedCards)
    let output = `CARDS\n${selectedCards.map(cardToString).join(' ')}\n\n`
    output += `HAND\n${result.rank.replace(/_/g, ' ')}\n\n`
    output += `SCORE\n${result.score}\n\n`
    output += `BEST FIVE\n${result.best5.map(cardToString).join(' ')}`

    document.getElementById('evalResult').textContent = output
  } catch (error) {
    document.getElementById('evalResult').textContent =
      `ERROR\n${error.message}`
  }
}

function runBenchmark() {
  const button = event.target
  button.disabled = true
  button.textContent = 'Running...'

  setTimeout(() => {
    const start = performance.now()
    const iterations = 1000

    for (let i = 0; i < iterations; i++) {
      const game = newGame({ players: 6, seed: i })
      game.deal()
      game.flop()
      game.turn()
      game.river()
      game.showdown()
    }

    const duration = (performance.now() - start) / 1000
    const handsPerSec = Math.round(iterations / duration)

    document.getElementById('benchResult').textContent =
      `BENCHMARK COMPLETE\n\n` +
      `HANDS\n${iterations.toLocaleString()}\n\n` +
      `TIME\n${duration.toFixed(2)}s\n\n` +
      `RATE\n${handsPerSec.toLocaleString()} hands/sec`

    button.disabled = false
    button.textContent = 'Run 1000 Hands'
  }, 10)
}

// Helper functions
function cardToString(card) {
  const suits = { s: '♠', h: '♥', d: '♦', c: '♣' }
  return `${card.rank}${suits[card.suit] || card.suit}`
}

function getSuitColor(suit) {
  return suit === 'h' || suit === 'd' ? 'red' : 'black'
}

// Live Demo Functions - Uses PokerPocket engine API with betting
function dealLiveHand() {
  const playersElement = document.getElementById('live-players')
  const outputElement = document.getElementById('live-output')
  const dealBtn = document.getElementById('deal-btn')

  const players = parseInt(playersElement?.value) || 3
  const seedInput = document.getElementById('seed').value
  const seed = seedInput
    ? parseInt(seedInput)
    : Math.floor(Math.random() * 10000)

  // UI feedback during processing
  if (dealBtn) {
    dealBtn.disabled = true
    dealBtn.textContent = 'Dealing...'
  }

  try {
    // Create new game using PokerPocket engine
    const game = newGame({ players, seed })

    // Initialize betting with default stacks and blinds
    const defaultStack = 1000
    const blindsConfig = { smallBlind: 25, bigBlind: 50, ante: 0 }
    let bettingState = betting.initBettingWithDefaults(players, 0, defaultStack)
    const actionLog = []

    // Deal and post blinds
    game.deal()
    bettingState = betting.postBlinds(bettingState, blindsConfig)
    actionLog.push(
      `💰 Blinds posted: SB ${blindsConfig.smallBlind}, BB ${blindsConfig.bigBlind}`
    )

    // Helper function for simple, educational AI decisions
    function makeRealisticAction(state, playerIndex, street) {
      const legalActions = betting.legalActions(state, playerIndex)

      // Use seed for deterministic but varied behavior
      const playerSeed = (seed + playerIndex + street.length) % 100

      // If can check, usually check (passive demo)
      if (legalActions.some((a) => a.type === 'check')) {
        if (playerSeed < 70) {
          return { player: playerIndex, type: 'check' }
        }
        // Sometimes bet small
        const betAction = legalActions.find((a) => a.type === 'bet')
        if (betAction) {
          const betSize = Math.min(betAction.max, blindsConfig.bigBlind)
          return { player: playerIndex, type: 'bet', amount: betSize }
        }
        return { player: playerIndex, type: 'check' }
      }

      // Facing a bet - simple decisions
      if (legalActions.some((a) => a.type === 'call')) {
        if (playerSeed < 20) {
          return { player: playerIndex, type: 'fold' }
        } else if (playerSeed < 85) {
          return { player: playerIndex, type: 'call' }
        } else {
          // Rare small raise
          const raiseAction = legalActions.find((a) => a.type === 'raise')
          if (raiseAction) {
            const raiseSize = Math.min(raiseAction.max, raiseAction.min)
            return { player: playerIndex, type: 'raise', amount: raiseSize }
          }
          return { player: playerIndex, type: 'call' }
        }
      }

      // Fallback to first legal action
      return { player: playerIndex, type: legalActions[0].type }
    }

    // Simulate betting rounds with clear explanations
    function simulateStreet(streetName) {
      const activePlayers = betting.getActivePlayers(bettingState)
      if (activePlayers.length <= 1) return

      actionLog.push(`\n🃏 ${streetName.toUpperCase()}:`)
      let actionCount = 0
      const maxActions = players * 2 // Prevent infinite loops

      while (
        !betting.isRoundComplete(bettingState) &&
        actionCount < maxActions
      ) {
        const actingPlayer = bettingState.actingIndex
        const action = makeRealisticAction(
          bettingState,
          actingPlayer,
          streetName
        )

        try {
          const prevPot = betting.getTotalPot(bettingState)
          bettingState = betting.applyAction(bettingState, action)
          const newPot = betting.getTotalPot(bettingState)

          // Log the action with context
          let actionStr = `   P${actingPlayer + 1} ${action.type}`
          if (action.amount) {
            actionStr += ` ${action.amount} chips`
          }
          if (newPot !== prevPot) {
            actionStr += ` → pot now ${newPot}`
          }
          actionLog.push(actionStr)

          actionCount++

          // Add educational notes for interesting actions
          if (action.type === 'fold') {
            actionLog.push(`     (P${actingPlayer + 1} gave up their hand)`)
          } else if (action.type === 'raise') {
            actionLog.push(`     (Aggressive play - increasing the bet!)`)
          }
        } catch {
          // Fallback to safe action
          const safeActions = betting.legalActions(bettingState, actingPlayer)
          if (safeActions.length > 0) {
            const safeAction = safeActions[0]
            bettingState = betting.applyAction(bettingState, {
              player: actingPlayer,
              type: safeAction.type
            })
            actionLog.push(`   P${actingPlayer + 1} ${safeAction.type}`)
          }
          actionCount++
        }
      }

      if (betting.isRoundComplete(bettingState)) {
        actionLog.push(`   ✓ Betting round complete`)
      }
    }

    // Pre-flop betting
    simulateStreet('preflop')

    // Check if hand ended early (all but one folded)
    let activePlayers = betting.getActivePlayers(bettingState)
    if (activePlayers.length <= 1) {
      const winner = activePlayers[0]
      const totalPot = betting.getTotalPot(bettingState)
      actionLog.push(`\n🏆 HAND OVER: P${winner + 1} wins ${totalPot} chips!`)
      actionLog.push(`   All other players folded - no showdown needed`)

      let output = `🎯 POKER HAND SIMULATION (Seed: ${seed})\n`
      output += `═══════════════════════════════════════\n\n`
      output += `💡 Early finish! This shows how betting pressure can win pots\n`
      output += `   without needing the best hand - a key poker concept!\n\n`
      output += `📋 HAND HISTORY:\n${actionLog.join('\n')}\n\n`
      output += `🎮 Try again to see a hand go to showdown!`

      if (outputElement) outputElement.textContent = output
      return
    }

    // Continue to flop
    game.flop()
    bettingState = betting.startNewRound(bettingState)
    simulateStreet('flop')

    activePlayers = betting.getActivePlayers(bettingState)
    if (activePlayers.length <= 1) {
      const winner = activePlayers[0]
      const totalPot = betting.getTotalPot(bettingState)
      actionLog.push(`\n🏆 HAND OVER: P${winner + 1} wins ${totalPot} chips!`)
      actionLog.push(`   Opponents folded after seeing the flop`)

      let output = `🎯 POKER HAND SIMULATION (Seed: ${seed})\n`
      output += `═══════════════════════════════════════\n\n`
      output += `💡 Flop victory! Community cards influenced the betting\n\n`
      output += `📋 HAND HISTORY:\n${actionLog.join('\n')}\n\n`
      output += `🃏 FLOP WAS:\n${game.status().boardAscii}\n\n`
      output += `🎮 Different seeds show how board texture affects play!`

      if (outputElement) outputElement.textContent = output
      return
    }

    // Continue to turn
    game.turn()
    bettingState = betting.startNewRound(bettingState)
    simulateStreet('turn')

    // Continue to river
    game.river()
    bettingState = betting.startNewRound(bettingState)
    simulateStreet('river')

    // Showdown and pot distribution
    const result = game.showdown()
    const distribution = betting.distributePots(bettingState, result.winners)
    const status = game.status()

    // Format educational output
    let output = `🎯 POKER HAND SIMULATION (Seed: ${seed})\n`
    output += `═══════════════════════════════════════\n\n`

    output += `💡 This demo shows PokerPocket's betting engine in action!\n`
    output += `   • ${players} players start with ${defaultStack} chips each\n`
    output += `   • Blinds: ${blindsConfig.smallBlind}/${blindsConfig.bigBlind}\n`
    output += `   • Watch how the pot grows through betting rounds\n\n`

    // Show action log
    output += `📋 HAND HISTORY:\n${actionLog.join('\n')}\n\n`

    // Show board
    output += `🃏 COMMUNITY CARDS:\n${status.boardAscii}\n\n`

    // Show results only for players who didn't fold
    const remainingPlayers = result.results.filter(
      ({ player }) => !bettingState.players[player].hasFolded
    )

    if (remainingPlayers.length > 1) {
      output += `🏆 SHOWDOWN - WHO WINS?\n`
      remainingPlayers.forEach(({ player, eval: evalResult, hole }) => {
        const holeStr = hole.map(cardToString).join(' ')
        const handRank = evalResult.rank.replace(/_/g, ' ').toLowerCase()
        const winner = result.winners.includes(player) ? ' 🏆 WINNER!' : ''
        output += `P${player + 1}: ${holeStr} = ${handRank}${winner}\n`
      })
    }

    // Show pot distribution
    output += `\n💰 CHIP DISTRIBUTION:\n`
    distribution.forEach(({ player, amount }) => {
      output += `P${player + 1} wins ${amount.toLocaleString()} chips\n`
    })

    output += `\n🎮 Try different seeds or player counts to see varied outcomes!`

    if (outputElement) {
      outputElement.textContent = output
    }
  } catch (error) {
    const friendlyError = error.message.includes('players')
      ? 'Invalid number of players. Please select 2-8 players.'
      : error.message.includes('seed')
        ? 'Invalid game seed. Please try again.'
        : `Game error: ${error.message}. Please try dealing again.`

    if (outputElement) {
      outputElement.textContent = `❌ ${friendlyError}`
    }
    console.error('PokerPocket Demo Error:', error)
  } finally {
    if (dealBtn) {
      dealBtn.disabled = false
      dealBtn.textContent = 'Deal Hand'
    }
  }
}

function resetLiveDemo() {
  document.getElementById('live-output').textContent =
    'Click "Deal Hand" to simulate a complete Texas Hold\'em hand with betting'
  document.getElementById('live-players').value = '3'
}

// Quick Start Copy Function
async function copyQuickStart() {
  const codeElement = document.getElementById('quick-start-code')
  const copyBtn = document.getElementById('copy-btn')
  const copyText = document.getElementById('copy-text')

  try {
    await navigator.clipboard.writeText(codeElement.textContent)

    // Visual feedback
    copyBtn.classList.add('copied')
    copyText.textContent = 'Copied!'

    // Reset after 2 seconds
    setTimeout(() => {
      copyBtn.classList.remove('copied')
      copyText.textContent = 'Copy'
    }, 2000)
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = codeElement.textContent
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)

    copyText.textContent = 'Copied!'
    setTimeout(() => {
      copyText.textContent = 'Copy'
    }, 2000)
  }
}

// Initialize the card display with placeholders when page loads
document.addEventListener('DOMContentLoaded', function () {
  updateCardDisplay()
})
