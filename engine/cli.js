#!/usr/bin/env node
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import {
  createTable,
  reduce,
  startHand,
  dealCards,
  toShowdown,
  nextHand,
  getPhase,
  getPlayers,
  getBoard,
  getPotSize,
  getCurrentPlayer,
  getLegalActions,
  getToCall,
  fold,
  check,
  call,
  raiseTo,
} from '@pokerpocket/engine'

const KEYMAP = Object.freeze({
  f: 'fold',
  k: 'check',
  c: 'call',
  r: 'raise',
  q: 'quit',
})

const log = (...args) => {
  console.log(...args)
}

function needsInput(state) {
  const phase = getPhase(state)
  if (
    !(
      phase === 'PREFLOP' ||
      phase === 'FLOP' ||
      phase === 'TURN' ||
      phase === 'RIVER'
    )
  ) {
    return false
  }

  const player = getCurrentPlayer(state)
  if (!player) return false

  const seat = player.id ?? ('toAct' in state ? state.toAct : undefined)
  if (typeof seat !== 'number') return false

  const legal = getLegalActions(state, seat)
  return Boolean(
    legal.canFold ||
      legal.canCheck ||
      legal.canCall ||
      legal.minRaise !== undefined
  )
}

function nextAutoAction(state) {
  switch (state.tag) {
    case 'INIT':
      return startHand()
    case 'DEAL':
      return dealCards()
    case 'SHOWDOWN':
      return toShowdown()
    default:
      return null
  }
}

function drive(state) {
  let current = state
  for (;;) {
    if (needsInput(current) || current.tag === 'COMPLETE') {
      return current
    }
    const action = nextAutoAction(current)
    if (!action) return current
    current = reduce(current, action)
  }
}

function resetForNextHand(state) {
  if (state.tag !== 'DEAL') return state
  return {
    ...state,
    players: state.players.map(player => ({
      ...player,
      bet: 0,
      contributed: 0,
      folded: false,
      allIn: false,
      hole: undefined,
    })),
  }
}

// Determine BTN/SB/BB markers for the current hand
function getPositionLabels(state, playerCount) {
  const labels = Array(playerCount).fill('')
  if (!playerCount) return labels
  const dealer =
    typeof state.dealer === 'number'
      ? ((state.dealer % playerCount) + playerCount) % playerCount
      : 0

  if (playerCount === 1) {
    labels[dealer] = 'BTN/SB/BB'
    return labels
  }

  if (playerCount === 2) {
    labels[dealer] = 'BTN/SB'
    labels[(dealer + 1) % playerCount] = 'BB'
    return labels
  }

  labels[dealer] = 'BTN'
  labels[(dealer + 1) % playerCount] = 'SB'
  labels[(dealer + 2) % playerCount] = 'BB'
  return labels
}

/**
 * @typedef {Object} Presentation
 * @property {string} header
 * @property {string} [board]
 * @property {number} [pot]
 * @property {Array<{ marker: string, line: string }>} rows
 * @property {string} [footer]
 */

/** @returns {Presentation} */
function present(state) {
  const phase = getPhase(state)
  const board = getBoard(state)
  const pot = getPotSize(state)
  const players = getPlayers(state)
  const positions = getPositionLabels(state, players.length)
  const toAct =
    'toAct' in state &&
    (phase === 'PREFLOP' || phase === 'FLOP' || phase === 'TURN' || phase === 'RIVER')
      ? state.toAct
      : null

  const rows = players.map((player, index) => {
    const marker = toAct === index ? '->' : '  '
    const hole = player.hole ? player.hole.join(' ') : '--'
    const position = positions[index]
    const positionTag = position ? `[${position}] ` : ''
    const flags = [
      player.folded ? 'folded' : null,
      player.allIn ? 'all-in' : null,
    ]
      .filter(Boolean)
      .join(', ')
    const status = flags ? ` (${flags})` : ''

    return {
      marker,
      line: `${positionTag}${player.name} | stack: ${player.stack} | bet: ${player.bet} | hole: ${hole}${status}`,
    }
  })

  const presentation = {
    header: `=== Phase: ${phase} ===`,
    rows,
  }
  if (board.length) {
    presentation.board = board.join(' ')
  }
  if (pot > 0) {
    presentation.pot = pot
  }
  return presentation
}

function render(state) {
  const view = present(state)
  log('')
  log(view.header)
  if (view.board) {
    log('Board:', view.board)
  }
  if (view.pot) {
    log('Pot:', view.pot)
  }
  view.rows.forEach(row => {
    log(`${row.marker} ${row.line}`)
  })
  if (view.footer) {
    log(view.footer)
  }
}

async function askNumber(rl, prompt, fallback, options = {}) {
  while (true) {
    const answer = (await rl.question(`${prompt} [${fallback}]: `)).trim()
    if (answer === '') return fallback
    const value = Number(answer)
    if (!Number.isFinite(value)) {
      log('Please enter a number.')
      continue
    }
    if (options.min !== undefined && value < options.min) {
      log(`Minimum is ${options.min}.`)
      continue
    }
    if (options.max !== undefined && value > options.max) {
      log(`Maximum is ${options.max}.`)
      continue
    }
    return value
  }
}

async function promptAction(state, rl) {
  const currentPlayer = getCurrentPlayer(state)
  const seat = currentPlayer?.id ?? ('toAct' in state ? state.toAct : undefined)
  if (typeof seat !== 'number') {
    log('No active player, advancing...')
    return null
  }

  const legal = getLegalActions(state, seat)
  const toCallAmount = getToCall(state, seat)
  const players = getPlayers(state)
  const actorName = currentPlayer?.name ?? players[seat]?.name ?? `Seat ${seat}`

  const options = []
  if (legal.canFold) options.push('(f)old')
  if (legal.canCheck) options.push('(k)check')
  if (legal.canCall) options.push(`(c)all ${toCallAmount}`)
  if (legal.minRaise !== undefined) {
    const unopened = toCallAmount === 0
    const range =
      legal.maxRaise !== undefined
        ? `${legal.minRaise}-${legal.maxRaise}`
        : `${legal.minRaise}+`
    options.push(`(r) ${unopened ? 'bet' : 'raise to'} ${range}`)
  }
  options.push('(q)uit')

  log(`\n${actorName}'s turn. Available: ${options.join(', ')}`)
  if (legal.minRaise !== undefined) {
    const maxHint =
      legal.maxRaise !== undefined
        ? `max ${legal.maxRaise}`
        : 'no max (to stack)'
    log(`Hint: enter "r <amount>", min ${legal.minRaise}, ${maxHint}.`)
  }

  while (true) {
    const raw = (await rl.question('Action: ')).trim().toLowerCase()
    if (!raw) {
      log('Enter an action.')
      continue
    }

    const [key, amountText] = raw.split(/\s+/, 2)
    const intent =
      KEYMAP[key] ||
      (Object.values(KEYMAP).includes(raw) ? raw : undefined)

    if (!intent) {
      log('Invalid action, try again.')
      continue
    }

    if (intent === 'quit') {
      return null
    }

    if (intent === 'fold') {
      if (!legal.canFold) {
        log('Fold is not available.')
        continue
      }
      return fold(seat)
    }

    if (intent === 'check') {
      if (!legal.canCheck) {
        log('Check is not available.')
        continue
      }
      return check(seat)
    }

    if (intent === 'call') {
      if (!legal.canCall) {
        log('Call is not available.')
        continue
      }
      return call(seat)
    }

    if (intent === 'raise') {
      if (legal.minRaise === undefined) {
        log('Raise is not available.')
        continue
      }
      if (!amountText) {
        log('Enter raise size as "r <amount>" (raise-to amount).')
        continue
      }
      const amount = Number(amountText)
      if (!Number.isFinite(amount)) {
        log('Please enter a numeric raise size (raise-to amount).')
        continue
      }
      if (amount < legal.minRaise) {
        log(`Hint: minimum raise is ${legal.minRaise}. Sending anyway...`)
      }
      if (legal.maxRaise !== undefined && amount > legal.maxRaise) {
        log(`Hint: maximum raise is ${legal.maxRaise}. Sending anyway...`)
      }
      return raiseTo(seat, amount)
    }
  }
}

async function main() {
  const rl = createInterface({ input, output })
  rl.on('SIGINT', () => {
    rl.close()
    process.exit(0)
  })

  try {
    log('🃏 PokerPocket CLI — quick demo client for @pokerpocket/engine')

    const seats = await askNumber(rl, 'Number of players', 2, {
      min: 2,
      max: 9,
    })
    const chips = await askNumber(rl, 'Starting stack', 1000, { min: 1 })
    const bigBlind = await askNumber(rl, 'Big blind size', 50, { min: 1 })

    let state = drive(createTable(seats, chips, bigBlind))

    while (true) {
      state = drive(state)
      render(state)

      if (needsInput(state)) {
        const action = await promptAction(state, rl)
        if (!action) break
        state = reduce(state, action)
        continue
      }

      const phase = getPhase(state)
      if (phase === 'COMPLETE') {
        const players = getPlayers(state)
        const winners = (state.winners || [])
          .map(w => `${players[w.seatId]?.name ?? `Seat ${w.seatId}`} +${w.amount}`)
          .join(', ')
        log('\nHand complete. Winners:', winners || 'none')

        const again = (await rl.question('Play another hand? [Y/n]: ')).trim()
        if (again.toLowerCase() === 'n') break
        state = resetForNextHand(reduce(state, nextHand()))
        continue
      }
    }
  } finally {
    rl.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
