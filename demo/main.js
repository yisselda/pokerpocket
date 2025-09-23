import { newGame, evaluate7, drawRandom } from 'poker-pocket'

// State
let selectedCards = []

// Make functions global
window.playQuickGame = playQuickGame
window.addCard = addCard
window.addRandomCards = addRandomCards
window.clearCards = clearCards
window.evaluateHand = evaluateHand
window.runBenchmark = runBenchmark

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
  container.innerHTML = selectedCards
    .map(
      (card, i) =>
        `<div class="card ${getSuitColor(card.suit)}" onclick="removeCard(${i})" title="Click to remove">
            ${cardToString(card)}
        </div>`
    )
    .join('')
}

function removeCard(index) {
  selectedCards.splice(index, 1)
  updateCardDisplay()
  document.getElementById('evalBtn').disabled = selectedCards.length < 5
}

// Make removeCard global
window.removeCard = removeCard

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
