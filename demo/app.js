// PokerPocket Demo Application
// Imports from the PokerPocket engine
import { newGame, evaluate7, drawRandom } from 'poker-pocket'

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

// Live Demo Functions - Uses PokerPocket engine API
function dealLiveHand() {
  const playersElement = document.getElementById('live-players')
  const outputElement = document.getElementById('live-output')
  const dealBtn = document.getElementById('deal-btn')

  const players = parseInt(playersElement?.value) || 3
  const seed = Math.floor(Math.random() * 10000)

  // UI feedback during processing
  if (dealBtn) {
    dealBtn.disabled = true
    dealBtn.textContent = 'Dealing...'
  }

  try {
    // Create new game using PokerPocket engine
    const game = newGame({ players, seed })

    // Execute full poker hand: deal → flop → turn → river → showdown
    game.deal()
    game.flop()
    game.turn()
    game.river()
    const result = game.showdown()

    // Get game state for display
    const status = game.status()

    // Format user-friendly output
    let output = `🎲 SEED: ${seed}\n\n`
    output += `🃏 BOARD\n${status.boardAscii}\n\n`
    output += `👥 PLAYERS & RESULTS\n`

    result.results.forEach(({ player, eval: evalResult, hole }) => {
      const holeStr = hole.map(cardToString).join(' ')
      const handRank = evalResult.rank.replace(/_/g, ' ')
      const winner = result.winners.includes(player) ? ' 🏆' : ''
      const playerLabel = `P${player + 1}`.padEnd(3)
      output += `${playerLabel} ${holeStr.padEnd(8)} ${handRank}${winner}\n`
    })

    // Display winner(s)
    if (result.winners.length === 1) {
      output += `\n🎉 WINNER: Player ${result.winners[0] + 1}!`
    } else {
      const winnerList = result.winners.map((w) => `P${w + 1}`).join(' & ')
      output += `\n🤝 TIE: ${winnerList}`
    }

    if (outputElement) {
      outputElement.textContent = output
    }
  } catch (error) {
    // User-friendly error handling
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
    // Always re-enable UI
    if (dealBtn) {
      dealBtn.disabled = false
      dealBtn.textContent = 'Deal Hand'
    }
  }
}

function resetLiveDemo() {
  document.getElementById('live-output').textContent =
    'Click "Deal Hand" to start playing poker'
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
  } catch (err) {
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
