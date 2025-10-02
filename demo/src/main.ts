import {
  LcgRng,
  check,
  call,
  fold,
  raiseTo,
  startHand,
  dealCards,
  toShowdown,
  createTable,
  reduce,
  getPhase,
  getPlayers,
  getBoardCards,
  getBoardAscii,
  getLegalActions,
  getToCall,
  getActingSeat,
  serializeRng,
} from '@pokerpocket/engine'
import type {
  Action,
  Card,
  GameState,
  LegalActions,
  Player,
} from '@pokerpocket/engine'
import { fromString, toAscii, createDeck, shuffle } from '@pokerpocket/engine/cards'
import { evaluateCards } from '@pokerpocket/engine/eval'
import {
  formatAction as formatReducerAction,
  formatChips,
} from '@pokerpocket/engine/format'

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
type SuitCode = 's' | 'h' | 'd' | 'c'

type CardCode = `${(typeof RANK_ORDER)[number]}${SuitCode}`

let selectedCards: CardCode[] = []

declare global {
  interface Window {
    dealLiveHand: typeof dealLiveHand
    resetLiveDemo: typeof resetLiveDemo
    addCard: typeof addCard
    addRandomCards: typeof addRandomCards
    clearCards: typeof clearCards
    evaluateHand: typeof evaluateHand
    removeCard: typeof removeCard
    runBenchmark: typeof runBenchmark
    copyQuickStart: typeof copyQuickStart
  }
}

function autoAdvance(initial: GameState): GameState {
  let state = initial
  while (true) {
    if (state.tag === 'INIT') {
      state = reduce(state, startHand())
      continue
    }
    if (state.tag === 'DEAL') {
      state = reduce(state, dealCards())
      continue
    }
    if (state.tag === 'SHOWDOWN') {
      state = reduce(state, toShowdown())
      continue
    }
    return state
  }
}

function pickAction(
  seat: number,
  legal: LegalActions,
  step: number,
  seed: number
): Action {
  const options: Array<'FOLD' | 'CHECK' | 'CALL' | 'RAISE'> = []
  if (legal.canCheck) options.push('CHECK')
  if (legal.canCall) options.push('CALL')
  if (typeof legal.minRaise === 'number') options.push('RAISE')
  if (legal.canFold) options.push('FOLD')

  if (options.length === 0) {
    return legal.canFold ? fold(seat) : check(seat)
  }

  const index = Math.abs(seed + seat * 13 + step * 17) % options.length
  const choice = options[index]

  switch (choice) {
    case 'CHECK':
      return check(seat)
    case 'CALL':
      return call(seat)
    case 'RAISE': {
      const min = legal.minRaise ?? 0
      const max = legal.maxRaise ?? min
      const span = Math.max(0, max - min)
      const raiseToAmount = span > 0 ? min + Math.floor(span * 0.35) : min
      return raiseTo(seat, raiseToAmount || min)
    }
    case 'FOLD':
    default:
      return fold(seat)
  }
}

interface SimulationResult {
  finalState: GameState
  board: Card[]
  boardAscii: string
  history: string[]
  rngSnapshot?: number
}

function simulateHand(playerCount: number, seed: number): SimulationResult {
  let state = autoAdvance(createTable(playerCount, 20000, 100, { seed }))
  const history: string[] = []
  let step = 0

  while (state.tag !== 'COMPLETE' && step < 200) {
    const actingSeat = getActingSeat(state)
    if (actingSeat === null) break
    const legal = getLegalActions(state, actingSeat)
    const action = pickAction(actingSeat, legal, step, seed)
    const phase = getPhase(state)
    history.push(
      `${phase}: ${formatReducerAction(action, { prefixSeat: true })}`
    )

    state = autoAdvance(reduce(state, action))
    step += 1
  }

  return {
    finalState: state,
    board: getBoardCards(state),
    boardAscii: getBoardAscii(state),
    history,
    rngSnapshot: serializeRng(state),
  }
}

function cardToAscii(code: CardCode): string {
  return toAscii(fromString(code))
}

function formatCategory(category: string) {
  return category
    .split('_')
    .map(part => part[0] + part.slice(1).toLowerCase())
    .join(' ')
}

function formatPlayers(players: Player[]) {
  return players
    .map(player => {
      const cards = player.hole?.map(cardToAscii).join(' ') ?? '--'
      const flags = [player.folded ? 'folded' : '', player.allIn ? 'all-in' : '']
        .filter(Boolean)
        .join(', ')
      const status = flags ? ` (${flags})` : ''
      return `P${(player.id ?? 0) + 1}  ${cards.padEnd(9)} stack ${formatChips(player.stack)}${status}`
    })
    .join('\n')
}

function formatWinners(state: GameState) {
  if (state.tag !== 'COMPLETE' || !state.winners?.length) {
    return 'Hand not complete'
  }
  return state.winners
    .map(w => `P${w.seatId + 1} +${formatChips(w.amount)}`)
    .join(', ')
}

function describeToCall(state: GameState, seat: number): string {
  const amount = getToCall(state, seat)
  if (amount === 0) return 'to call: 0'
  return `to call: ${formatChips(amount)}`
}

function dealLiveHand() {
  const playersElement = document.getElementById('live-players') as
    | HTMLSelectElement
    | null
  const seedElement = document.getElementById('seed') as HTMLInputElement | null
  const output = document.getElementById('live-output')
  const dealButton = document.getElementById('deal-btn') as HTMLButtonElement | null

  const players = parseInt(playersElement?.value ?? '3', 10) || 3
  const seedValue = seedElement?.value
  const seed = seedValue && !Number.isNaN(Number(seedValue))
    ? Number(seedValue)
    : Math.floor(Math.random() * 1_000_000)

  if (output) {
    output.textContent = 'Simulating reducer-driven hand...'
  }
  if (dealButton) {
    dealButton.disabled = true
    dealButton.textContent = 'Dealing...'
  }

  const result = simulateHand(players, seed)
  const { finalState, boardAscii, history, rngSnapshot } = result
  const playerSummaries = formatPlayers(getPlayers(finalState))
  const actingSeat = getActingSeat(finalState)
  const toCallInfo =
    actingSeat !== null ? describeToCall(finalState, actingSeat) : 'hand complete'

  const summary = `🎯 PokerPocket reducer demo\n` +
    `Seed ${seed} • ${players} players • Blinds 100/200\n\n` +
    `Phase\n${getPhase(finalState)} (${toCallInfo})\n\n` +
    `Board\n${boardAscii || '[no board dealt yet]'}\n\n` +
    `Players\n${playerSummaries}\n\n` +
    `Winners\n${formatWinners(finalState)}\n\n` +
    `RNG snapshot\n${rngSnapshot ?? 'N/A'}\n\n` +
    `Action trace\n${history.join('\n')}`

  if (output) {
    output.textContent = summary
  }

  if (dealButton) {
    dealButton.disabled = false
    dealButton.textContent = 'Deal Hand'
  }
}

function resetLiveDemo() {
  const output = document.getElementById('live-output')
  if (output) {
    output.textContent =
      'Click "Deal Hand" to simulate a complete Texas Hold\'em hand with deterministic RNG.'
  }
  const seed = document.getElementById('seed') as HTMLInputElement | null
  if (seed) seed.value = ''
}

function addCard() {
  if (selectedCards.length >= 7) {
    alert('Maximum 7 cards')
    return
  }

  const rankSelect = document.getElementById('cardRank') as HTMLSelectElement
  const suitSelect = document.getElementById('cardSuit') as HTMLSelectElement
  const code = `${rankSelect.value}${suitSelect.value}` as CardCode

  if (selectedCards.includes(code)) {
    alert('Card already selected')
    return
  }

  selectedCards.push(code)
  updateCardDisplay()
}

function addRandomCards() {
  const rng = new LcgRng(Date.now())
  const shuffledDeck = shuffle(createDeck(), rng)
  const count = 5 + Math.floor(rng.next() * 3)
  selectedCards = shuffledDeck
    .slice(0, count)
    .map(card => `${card.rank}${card.suit}` as CardCode)
  updateCardDisplay()
}

function clearCards() {
  selectedCards = []
  updateCardDisplay()
}

function removeCard(index: number) {
  selectedCards.splice(index, 1)
  updateCardDisplay()
}

function updateCardDisplay() {
  const container = document.getElementById('cards')
  const evalBtn = document.getElementById('evalBtn') as HTMLButtonElement | null

  if (container) {
    const cardsHtml = selectedCards
      .map(
        (card, i) =>
          `<div class="card ${getSuitColor(card)}" onclick="removeCard(${i})" title="Click to remove">${cardToAscii(card)}</div>`
      )
      .join('')

    const placeholderCount = Math.max(0, 7 - selectedCards.length)
    const placeholders = Array.from({ length: placeholderCount }, () =>
      '<div class="card placeholder">🂠</div>'
    ).join('')

    container.innerHTML = cardsHtml + placeholders
  }

  if (evalBtn) {
    evalBtn.disabled = selectedCards.length < 5
  }

  const evalOutput = document.getElementById('evalResult')
  if (evalOutput && selectedCards.length === 0) {
    evalOutput.textContent = 'Add 5-7 cards to evaluate'
  }
}

function getSuitColor(code: CardCode) {
  const suit = code[1]
  return suit === 'h' || suit === 'd' ? 'red' : 'black'
}

function evaluateHand() {
  if (selectedCards.length < 5) return

  try {
    const evaluation = evaluateCards(selectedCards)
    const cardsLine = selectedCards.map(cardToAscii).join(' ')
    const ranksLine = evaluation.ranks
      .map(rankIndex => RANK_ORDER[rankIndex] ?? '?')
      .reverse()
      .join(' ')
    const output =
      `Cards\n${cardsLine}\n\n` +
      `Category\n${formatCategory(evaluation.category)}\n\n` +
      `Score\n${evaluation.score}\n\n` +
      `Ranks considered\n${ranksLine}`

    const evalOutput = document.getElementById('evalResult')
    if (evalOutput) evalOutput.textContent = output
  } catch (error) {
    const evalOutput = document.getElementById('evalResult')
    if (evalOutput) {
      evalOutput.textContent =
        error instanceof Error ? `ERROR\n${error.message}` : 'Evaluation failed'
    }
  }
}

function runBenchmark() {
  const button = document.getElementById('bench-btn') as HTMLButtonElement | null
  if (button) {
    button.disabled = true
    button.textContent = 'Running...'
  }

  setTimeout(() => {
    const iterations = 500
    const start = performance.now()

    for (let i = 0; i < iterations; i++) {
      simulateHand(6, i)
    }

    const elapsed = (performance.now() - start) / 1000
    const rate = Math.round(iterations / elapsed)

    const benchOutput = document.getElementById('benchResult')
    if (benchOutput) {
      benchOutput.textContent =
        `Reducer benchmark complete\n\n` +
        `Hands simulated\n${iterations}\n\n` +
        `Elapsed\n${elapsed.toFixed(2)}s\n\n` +
        `Throughput\n${rate.toLocaleString()} hands/sec`
    }

    if (button) {
      button.disabled = false
      button.textContent = 'Run 500 Hands'
    }
  }, 10)
}

async function copyQuickStart() {
  const command = 'npm install @pokerpocket/engine\nnpx @pokerpocket/engine --seed 42'
  const copyBtn = document.getElementById('copy-cli-quick') as HTMLButtonElement
  try {
    await navigator.clipboard.writeText(command)
    copyBtn.textContent = 'Copied!'
    setTimeout(() => {
      copyBtn.textContent = 'Copy'
    }, 2000)
  } catch {
    const textArea = document.createElement('textarea')
    textArea.value = command
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    copyBtn.textContent = 'Copied!'
    setTimeout(() => {
      copyBtn.textContent = 'Copy'
    }, 2000)
  }
}

window.dealLiveHand = dealLiveHand
window.resetLiveDemo = resetLiveDemo
window.addCard = addCard
window.addRandomCards = addRandomCards
window.clearCards = clearCards
window.evaluateHand = evaluateHand
window.removeCard = removeCard
window.runBenchmark = runBenchmark
window.copyQuickStart = copyQuickStart

updateCardDisplay()
resetLiveDemo()
