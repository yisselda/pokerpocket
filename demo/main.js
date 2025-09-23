import { newGame, evaluate7 } from 'poker-pocket'

// Game state
let currentGame = null
let currentPhase = 'idle'
let handsPlayedCount = 0

// Hand evaluator state
let selectedCards = []

// Card symbols mapping
const suitSymbols = {
    's': '♠',
    'h': '♥',
    'd': '♦',
    'c': '♣'
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('🃏 Poker Pocket Demo loaded!')
    updateStats()
})

// Global functions for demo
window.dealNewHand = dealNewHand
window.nextStreet = nextStreet
window.addCard = addCard
window.clearCards = clearCards
window.evaluateHand = evaluateHand
window.runBenchmark = runBenchmark

function dealNewHand() {
    const players = parseInt(document.getElementById('players').value) || 4
    const seedInput = document.getElementById('seed').value
    const seed = seedInput ? parseInt(seedInput) : Math.floor(Math.random() * 100000)

    const options = { players }
    if (seed) options.seed = seed

    currentGame = newGame(options)
    currentGame.deal()
    currentPhase = 'preflop'
    handsPlayedCount++

    updateGameDisplay()
    document.getElementById('nextBtn').disabled = false
    updateStats()
}

function nextStreet() {
    if (!currentGame) return

    try {
        switch (currentPhase) {
            case 'preflop':
                currentGame.flop()
                currentPhase = 'flop'
                break
            case 'flop':
                currentGame.turn()
                currentPhase = 'turn'
                break
            case 'turn':
                currentGame.river()
                currentPhase = 'river'
                break
            case 'river':
                const result = currentGame.showdown()
                currentPhase = 'showdown'
                document.getElementById('nextBtn').disabled = true
                break
        }
        updateGameDisplay()
    } catch (error) {
        console.error('Error in game progression:', error)
    }
}

function updateGameDisplay() {
    if (!currentGame) return

    const status = currentGame.status()
    let display = `🎮 Game Status - ${currentPhase.toUpperCase()}\n`
    display += `Players: ${status.players}\n`
    display += `Phase: ${status.phase}\n\n`

    // Show board cards
    if (status.boardAscii) {
        display += `🃏 Board: ${status.boardAscii}\n\n`
    }

    // Show hole cards for each player
    display += `👥 Player Hole Cards:\n`
    for (let i = 0; i < status.players; i++) {
        const holeCards = currentGame.getHoleCards(i)
        if (holeCards.length > 0) {
            const holeDisplay = holeCards.map(formatCard).join(' ')
            display += `  P${i + 1}: ${holeDisplay}\n`
        }
    }

    // Show showdown results if available
    if (currentPhase === 'showdown' && status.lastShowdown) {
        display += `\n🏆 SHOWDOWN RESULTS:\n`
        display += status.lastShowdown.results + '\n'
        display += status.lastShowdown.winners + '\n'
    }

    document.getElementById('gameDisplay').textContent = display
}

function formatCard(card) {
    return `${card.rank}${suitSymbols[card.suit] || card.suit}`
}

// Hand Evaluator Functions
function addCard() {
    if (selectedCards.length >= 7) {
        alert('Maximum 7 cards allowed')
        return
    }

    const rank = document.getElementById('cardRank').value
    const suit = document.getElementById('cardSuit').value

    const newCard = { rank, suit }

    // Check for duplicates
    const isDuplicate = selectedCards.some(card =>
        card.rank === newCard.rank && card.suit === newCard.suit
    )

    if (isDuplicate) {
        alert('Card already selected')
        return
    }

    selectedCards.push(newCard)
    updateCardDisplay()

    if (selectedCards.length >= 5) {
        document.getElementById('evalBtn').disabled = false
    }
}

function clearCards() {
    selectedCards = []
    updateCardDisplay()
    document.getElementById('evalBtn').disabled = true
    document.getElementById('evaluationResult').textContent = 'Add 5-7 cards to evaluate a poker hand'
}

function updateCardDisplay() {
    const container = document.getElementById('selectedCards')
    container.innerHTML = ''

    selectedCards.forEach((card, index) => {
        const cardElement = document.createElement('div')
        cardElement.className = `card ${getSuitClass(card.suit)}`
        cardElement.textContent = `${card.rank}${suitSymbols[card.suit]}`
        cardElement.onclick = () => removeCard(index)
        cardElement.style.cursor = 'pointer'
        cardElement.title = 'Click to remove'
        container.appendChild(cardElement)
    })
}

function getSuitClass(suit) {
    return suit === 'h' || suit === 'd' ? 'hearts' : 'spades'
}

function removeCard(index) {
    selectedCards.splice(index, 1)
    updateCardDisplay()

    if (selectedCards.length < 5) {
        document.getElementById('evalBtn').disabled = true
    }
}

function evaluateHand() {
    if (selectedCards.length < 5) {
        alert('Need at least 5 cards to evaluate')
        return
    }

    try {
        const result = evaluate7(selectedCards)

        let display = `🎯 HAND EVALUATION\n\n`
        display += `Selected Cards: ${selectedCards.map(formatCard).join(' ')}\n\n`
        display += `🏆 Hand Rank: ${result.rank.replace(/_/g, ' ')}\n`
        display += `📊 Score: ${result.score.toString()}\n`
        display += `🃏 Best 5: ${result.best5.map(formatCard).join(' ')}\n`
        display += `🎲 Tiebreak: [${result.tiebreak.join(', ')}]\n`

        document.getElementById('evaluationResult').textContent = display
    } catch (error) {
        document.getElementById('evaluationResult').textContent = `Error: ${error.message}`
    }
}

// Performance benchmark
function runBenchmark() {
    const startTime = performance.now()
    const iterations = 1000

    document.getElementById('handsPerSec').textContent = 'Running...'

    // Use setTimeout to prevent blocking the UI
    setTimeout(() => {
        for (let i = 0; i < iterations; i++) {
            const game = newGame({ players: 6, seed: i })
            game.deal()
            game.flop()
            game.turn()
            game.river()
            game.showdown()
        }

        const endTime = performance.now()
        const duration = (endTime - startTime) / 1000
        const handsPerSecond = Math.round(iterations / duration)

        document.getElementById('handsPerSec').textContent = handsPerSecond.toLocaleString()

        // Update total hands played
        handsPlayedCount += iterations
        updateStats()
    }, 10)
}

function updateStats() {
    document.getElementById('handsPlayed').textContent = handsPlayedCount.toLocaleString()
}