import {
  LcgRng,
  advanceUntilDecision,
  call,
  check,
  createTable,
  fold,
  getActionOptions,
  getBoard,
  computeWinningOdds,
  getPhase,
  getSeed,
  isBettingDecision,
  isHandDone,
  raiseTo,
  reduce,
  toPresentation,
} from '@pokerpocket/engine'
import type {
  Action,
  ActionOptions,
  GameState,
  PlayerOdds,
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

function pickAction(options: ActionOptions, step: number, seed: number): Action {
  const prng = Math.abs(seed + options.seat * 17 + step * 31)
  const eagerRaise = options.raise && prng % 4 === 0

  if (options.toCall === 0) {
    if (eagerRaise && options.raise) {
      const min = options.raise.min
      const max = options.raise.max ?? min
      const span = Math.max(0, max - min)
      const raiseToAmount = span > 0 ? min + Math.floor(span * 0.25) : min
      return raiseTo(options.seat, raiseToAmount || min)
    }
    if (options.canCheck) {
      return check(options.seat)
    }
  }

  if (options.canCall) {
    return call(options.seat)
  }

  if (options.raise) {
    const min = options.raise.min
    const max = options.raise.max ?? min
    const span = Math.max(0, max - min)
    const raiseToAmount = span > 0 ? min + Math.floor(span * 0.25) : min
    return raiseTo(options.seat, raiseToAmount || min)
  }

  if (options.canCheck) {
    return check(options.seat)
  }

  return options.canFold ? fold(options.seat) : check(options.seat)
}

interface SimulationSnapshot {
  phase: string
  board: string[]
  pot?: number
  odds?: PlayerOdds[]
}

interface SimulationResult {
  finalState: GameState
  history: string[]
  snapshots: SimulationSnapshot[]
  finalBoard: string[]
}

function simulateHand(playerCount: number, seed: number): SimulationResult {
  let state = advanceUntilDecision(createTable(playerCount, 10000, 100, { seed }))
  const history: string[] = []
  const snapshots: SimulationSnapshot[] = []
  let step = 0
  let latestBoard: string[] = []

  const boardsEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((card, index) => card === b[index])

  const recordSnapshot = (current: GameState) => {
    const view = toPresentation(current)
    const boardCards = getBoard(current)
    if (boardCards.length) {
      latestBoard = [...boardCards]
    }
    const snapshot: SimulationSnapshot = {
      phase: current.tag,
      board: [...boardCards],
      pot: view.pot ?? 0,
    }
    const last = snapshots[snapshots.length - 1]
    const shouldRecord =
      !last ||
      last.phase !== snapshot.phase ||
      !boardsEqual(last.board, snapshot.board) ||
      last.pot !== snapshot.pot

    if (!shouldRecord) return

    snapshot.odds = computeWinningOdds(current)
    snapshots.push(snapshot)
  }

  recordSnapshot(state)

  while (!isHandDone(state) && step < 200) {
    if (!isBettingDecision(state)) {
      const next = advanceUntilDecision(state)
      if (next === state) break
      state = next
      recordSnapshot(state)
      continue
    }

    const options = getActionOptions(state)
    if (!options) {
      const next = advanceUntilDecision(state)
      if (next === state) break
      state = next
      recordSnapshot(state)
      continue
    }

    const action = pickAction(options, step, seed)
    const phase = getPhase(state)
    history.push(
      `${phase}: ${formatReducerAction(action, { prefixSeat: true })}`
    )

    state = advanceUntilDecision(reduce(state, action))
    recordSnapshot(state)
    step += 1
  }

  return {
    finalState: state,
    history,
    snapshots,
    finalBoard: [...latestBoard],
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

function formatWinners(state: GameState) {
  if (state.tag !== 'COMPLETE' || !state.winners?.length) {
    return 'Hand not complete'
  }
  return state.winners
    .map(w => `P${w.seatId + 1} +${formatChips(w.amount)}`)
    .join(', ')
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
  const { finalState, history, snapshots, finalBoard } = result
  const view = toPresentation(finalState)
  const options = getActionOptions(finalState)

  const formatOddsTag = (
    odds: { equity: number; method: PlayerOdds['method']; considered: boolean } | undefined
  ) => {
    if (!odds || !odds.considered) return ''
    const base = `${(odds.equity * 100).toFixed(1)}%`
    if (odds.method === 'monteCarlo') return `${base} (MC)`
    if (odds.method === 'exact') return `${base} (exact)`
    return base
  }

  const playerSummaries = view.rows
    .map(row => {
      const odds = row.odds
      const oddsLabel = odds ? ` | odds: ${formatOddsTag(odds)}` : ''
      return `${row.marker} ${row.line}${oddsLabel}`
    })
    .join('\n')

  const decisionHint = (() => {
    if (isHandDone(finalState)) return 'hand complete'
    if (!options) return 'auto action pending'
    if (options.toCall > 0) {
      return `to call: ${formatChips(options.toCall)}`
    }
    if (options.raise) {
      const min = formatChips(options.raise.min)
      const max = options.raise.max ? formatChips(options.raise.max) : 'stack'
      const verb = options.raise.unopened ? 'bet' : 'raise to'
      return `${verb} ≥ ${min}${options.raise.max ? ` (max ${max})` : ''}`
    }
    return 'check or fold available'
  })()

  const phaseLabel = view.header.replace(/^===\s*/, '').replace(/\s*===$/, '')
  const boardLine =
    finalBoard.length > 0
      ? finalBoard.join(' ')
      : view.board ?? '[no board dealt yet]'
  const potLine = view.pot !== undefined ? formatChips(view.pot) : '0'
  const rngSnapshot = getSeed(finalState)
  const boardTimeline = snapshots
    .map(snapshot => {
      const boardCards = snapshot.board.length
        ? snapshot.board.join(' ')
        : '[no board dealt yet]'
      const potLabel =
        typeof snapshot.pot === 'number' && snapshot.pot > 0
          ? ` (pot ${formatChips(snapshot.pot)})`
          : ''
      const consideredOdds = snapshot.odds?.filter(o => o.considered) ?? []
      const oddsLabel = consideredOdds.length
        ? (() => {
            const parts = consideredOdds.map(o => {
              const playerName =
                finalState.players[o.seatIndex]?.name ?? `P${o.seatIndex + 1}`
              return `${playerName} ${formatOddsTag(o)}`
            })
            return ` • odds ${parts.join(' | ')}`
          })()
        : ''
      return `${snapshot.phase}: ${boardCards}${potLabel}${oddsLabel}`
    })
    .join('\n')
  const usedMonteCarlo = snapshots.some(snapshot =>
    snapshot.odds?.some(o => o.considered && o.method === 'monteCarlo')
  )
  const oddsNote = usedMonteCarlo
    ? 'Odds note: MC = Monte Carlo equity (20k samples)'
    : ''

  const summary = `🎯 PokerPocket reducer demo\n` +
    `Seed ${seed} • ${players} players • Blinds 100/200\n\n` +
    `Phase\n${phaseLabel} (${decisionHint})\n\n` +
    `Board\n${boardLine}\n\n` +
    `Pot\n${potLine}\n\n` +
    `Players\n${playerSummaries}\n\n` +
    `Board progression\n${boardTimeline}\n\n` +
    (oddsNote ? `${oddsNote}\n\n` : '') +
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
