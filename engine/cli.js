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

function renderState(state) {
  const phase = getPhase(state)
  const board = getBoard(state)
  const pot = getPotSize(state)
  const players = getPlayers(state)
  const positions = getPositionLabels(state, players.length)
  const toAct =
    state.tag === 'PREFLOP' ||
    state.tag === 'FLOP' ||
    state.tag === 'TURN' ||
    state.tag === 'RIVER'
      ? state.toAct
      : null

  console.log('\n=== Phase:', phase, '===')
  if (board.length) {
    console.log('Board:', board.join(' '))
  }
  if (pot > 0) {
    console.log('Pot:', pot)
  }

  players.forEach((player, index) => {
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
    console.log(
      `${marker} ${positionTag}${player.name} | stack: ${player.stack} | bet: ${player.bet} | hole: ${hole}${status}`
    )
  })
}

function autoAdvance(state) {
  let next = state
  while (true) {
    if (next.tag === 'INIT') {
      next = reduce(next, startHand())
      continue
    }
    if (next.tag === 'DEAL') {
      next = reduce(next, dealCards())
      continue
    }
    if (next.tag === 'SHOWDOWN') {
      next = reduce(next, toShowdown())
      continue
    }
    return next
  }
}

async function askNumber(rl, prompt, fallback, options = {}) {
  while (true) {
    const answer = (await rl.question(`${prompt} [${fallback}]: `)).trim()
    if (answer === '') return fallback
    const value = Number(answer)
    if (!Number.isFinite(value)) {
      console.log('Please enter a number.')
      continue
    }
    if (options.min !== undefined && value < options.min) {
      console.log(`Minimum is ${options.min}.`)
      continue
    }
    if (options.max !== undefined && value > options.max) {
      console.log(`Maximum is ${options.max}.`)
      continue
    }
    return value
  }
}

async function handleBetting(state, rl) {
  const seat = state.toAct
  const player = getCurrentPlayer(state)
  if (!player) {
    console.log('No active player, advancing...')
    return autoAdvance(state)
  }

  const legal = getLegalActions(state, seat)
  const toCallAmount = getToCall(state, seat)

  const options = []
  if (legal.canFold) options.push('(f)old')
  if (legal.canCheck) options.push('(k)check')
  if (legal.canCall) options.push(`(c)all ${toCallAmount}`)
  if (legal.minRaise !== undefined) {
    const unopened = toCallAmount === 0
    const labelBase = unopened ? 'bet' : 'raise to'
    const range =
      legal.maxRaise !== undefined
        ? `${legal.minRaise}-${legal.maxRaise}`
        : `${legal.minRaise}+`
    options.push(`(${unopened ? 'b' : 'r'}) ${labelBase} ${range}`)
  }
  options.push('(q)uit')

  console.log(`\n${player.name}'s turn. Available: ${options.join(', ')}`)

  while (true) {
    const input = (await rl.question('Action: ')).trim().toLowerCase()
    if (input === 'q' || input === 'quit') {
      return null
    }
    if ((input === 'f' || input === 'fold') && legal.canFold) {
      return reduce(state, fold(seat))
    }
    if ((input === 'k' || input === 'check') && legal.canCheck) {
      return reduce(state, check(seat))
    }
    if ((input === 'c' || input === 'call') && legal.canCall) {
      return reduce(state, call(seat))
    }
    if (
      input.startsWith('r') &&
      legal.minRaise !== undefined &&
      toCallAmount > 0
    ) {
      const parts = input.split(/\s+/)
      const amount = Number(parts[1])
      if (!Number.isFinite(amount)) {
        console.log('Enter raise size, e.g. "r 150" (raise-to amount).')
        continue
      }
      if (amount < legal.minRaise) {
        console.log(`Raise must be at least ${legal.minRaise}.`)
        continue
      }
      if (legal.maxRaise !== undefined && amount > legal.maxRaise) {
        console.log(`Raise cannot exceed ${legal.maxRaise}.`)
        continue
      }
      return reduce(state, raiseTo(seat, amount))
    }
    if (
      input.startsWith('b') &&
      legal.minRaise !== undefined &&
      toCallAmount === 0
    ) {
      const parts = input.split(/\s+/)
      const amount = Number(parts[1])
      if (!Number.isFinite(amount)) {
        console.log('Enter bet size, e.g. "b 150" (bet-to amount).')
        continue
      }
      if (amount < legal.minRaise) {
        console.log(`Bet must be at least ${legal.minRaise}.`)
        continue
      }
      if (legal.maxRaise !== undefined && amount > legal.maxRaise) {
        console.log(`Bet cannot exceed ${legal.maxRaise}.`)
        continue
      }
      return reduce(state, raiseTo(seat, amount))
    }
    console.log('Invalid action, try again.')
  }
}

async function main() {
  const rl = createInterface({ input, output })
  rl.on('SIGINT', () => {
    rl.close()
    process.exit(0)
  })

  try {
    console.log(
      '🃏 PokerPocket CLI — quick demo client for @pokerpocket/engine'
    )

    const seats = await askNumber(rl, 'Number of players', 2, {
      min: 2,
      max: 9,
    })
    const chips = await askNumber(rl, 'Starting stack', 1000, { min: 1 })
    const bigBlind = await askNumber(rl, 'Big blind size', 50, { min: 1 })

    let state = autoAdvance(createTable(seats, chips, bigBlind))

    while (true) {
      state = autoAdvance(state)
      renderState(state)

      if (
        state.tag === 'PREFLOP' ||
        state.tag === 'FLOP' ||
        state.tag === 'TURN' ||
        state.tag === 'RIVER'
      ) {
        const nextState = await handleBetting(state, rl)
        if (!nextState) break
        state = nextState
        continue
      }

      if (state.tag === 'COMPLETE') {
        const winners = state.winners
          .map(w => `${state.players[w.seatId].name} +${w.amount}`)
          .join(', ')
        console.log('\nHand complete. Winners:', winners || 'none')

        const again = (await rl.question('Play another hand? [Y/n]: ')).trim()
        if (again.toLowerCase() === 'n') break
        state = reduce(state, nextHand())
        continue
      }

      console.log('Advancing game state...')
      state = autoAdvance(state)
    }
  } finally {
    rl.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
