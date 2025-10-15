#!/usr/bin/env node
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import {
  advanceUntilDecision,
  call,
  check,
  createTable,
  fold,
  getActionOptions,
  getPlayers,
  isBettingDecision,
  isHandDone,
  nextHand,
  raiseTo,
  reduce,
  toPresentation,
} from '@pokerpocket/engine'

const KEYMAP = Object.freeze({
  f: 'fold',
  c: 'callOrCheck',
  r: 'raise',
  a: 'allin',
  q: 'quit',
})

const log = (...args) => {
  console.log(...args)
}

function parseArgs(argv) {
  const options = { seed: undefined }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--seed') {
      const value = argv[++i]
      if (!value) {
        console.error('Missing value for --seed')
        process.exit(1)
      }
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) {
        console.error('Seed must be a finite number')
        process.exit(1)
      }
      options.seed = parsed >>> 0
      continue
    }
    if (token.startsWith('--seed=')) {
      const value = token.slice('--seed='.length)
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) {
        console.error('Seed must be a finite number')
        process.exit(1)
      }
      options.seed = parsed >>> 0
      continue
    }
    if (token === '--help' || token === '-h') {
      console.log('Usage: pokerpocket [--seed <uint32>]')
      process.exit(0)
    }
    console.error(`Unknown option: ${token}`)
    process.exit(1)
  }

  return options
}

function render(state) {
  const view = toPresentation(state)
  log('')
  log(view.header)
  if (view.board) {
    log('Board:', view.board)
  }
  if (view.pot !== undefined) {
    log('Pot:', view.pot)
  }
  view.rows.forEach(row => {
    const odds = row.odds && row.odds.considered ? row.odds : null
    let suffix = ''
    if (odds) {
      const equity = (odds.equity * 100).toFixed(1)
      const method =
        odds.method === 'monteCarlo'
          ? ' (MC)'
          : odds.method === 'exact'
            ? ' (exact)'
            : ''
      suffix = ` | odds: ${equity}%${method}`
    }
    log(`${row.marker} ${row.line}${suffix}`)
  })
  const usedMonteCarlo = view.rows.some(
    row => row.odds?.considered && row.odds.method === 'monteCarlo'
  )
  if (usedMonteCarlo) {
    log('Odds note: MC = Monte Carlo equity (20k samples)')
  }
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
  const options = getActionOptions(state)
  if (!options) {
    log('No pending action — advancing automatically.')
    return null
  }

  const players = getPlayers(state)
  const actorName = players[options.seat]?.name ?? `Seat ${options.seat}`
  const menu = []
  if (options.canFold) menu.push('(f)old')
  if (options.canCheck) menu.push('(c)heck')
  else if (options.canCall) menu.push(`(c)all ${options.toCall}`)
  if (options.raise) {
    const { min, max, unopened } = options.raise
    const label = unopened ? 'bet' : 'raise to'
    const range = max !== undefined ? `${min}-${max}` : `${min}+`
    menu.push(`(r) ${label} ${range}`)
    menu.push('(a)ll in')
  }
  menu.push('(q)uit')

  log(`\n${actorName}'s turn. Available: ${menu.join(', ')}`)
  if (options.raise) {
    const { min, max } = options.raise
    const maxHint = max !== undefined ? `max ${max}` : 'no max (to stack)'
    log(`Hint: enter "r <amount>", min ${min}, ${maxHint}.`)
  }

  while (true) {
    const raw = (await rl.question('Action: ')).trim().toLowerCase()
    if (!raw) {
      log('Enter an action.')
      continue
    }

    const [key, amountText] = raw.split(/\s+/, 2)
    const normalized =
      KEYMAP[key] || (Object.values(KEYMAP).includes(raw) ? raw : undefined)

    if (!normalized) {
      log('Invalid action, try again.')
      continue
    }

    if (normalized === 'quit') {
      return null
    }

    if (normalized === 'fold') {
      if (!options.canFold) {
        log('Fold is not available.')
        continue
      }
      return fold(options.seat)
    }

    if (normalized === 'callOrCheck') {
      if (!options.canCheck && !options.canCall) {
        log('Check or Call is not available.')
        continue
      }
      if (options.canCheck) return check(options.seat)
      if (options.canCall) return call(options.seat)
    }

    const isAllIn = normalized == 'allin'
    if (normalized === 'raise' || isAllIn) {
      if (!options.raise) {
        log('Raise is not available.')
        continue
      }
      if (!isAllIn && !amountText) {
        log('Enter raise size as "r <amount>" (raise-to amount).')
        continue
      }
      const amount = isAllIn ? options.raise.max : Number(amountText)
      if (!Number.isFinite(amount)) {
        log('Please enter a numeric raise size (raise-to amount).')
        continue
      }
      if (amount < options.raise.min) {
        log(`Hint: minimum raise is ${options.raise.min}. Sending anyway...`)
      }
      if (options.raise.max !== undefined && amount > options.raise.max) {
        log(`Hint: maximum raise is ${options.raise.max}. Sending anyway...`)
      }
      return raiseTo(options.seat, amount)
    }
  }
}

async function main() {
  const cliOptions = parseArgs(process.argv.slice(2))
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

    let state = createTable(seats, chips, bigBlind, { seed: cliOptions.seed })

    if (cliOptions.seed !== undefined) {
      log(`Using RNG seed ${cliOptions.seed}`)
    }

    while (true) {
      state = advanceUntilDecision(state)
      render(state)

      if (isHandDone(state)) {
        const players = getPlayers(state)
        const winners = 'winners' in state ? state.winners : []
        const summary = winners
          .map(
            w => `${players[w.seatId]?.name ?? `Seat ${w.seatId}`} +${w.amount}`
          )
          .join(', ')
        log('\nHand complete. Winners:', summary || 'none')

        const playersLeft = players.filter(p => p.stack).length >= 2
        var questionToPlayer = playersLeft
          ? 'Play another hand? [Y/n]: '
          : 'Play a new game? [Y/n]: '
        const again = (await rl.question(questionToPlayer)).trim()
        if (again.toLowerCase() === 'n') break
        state = playersLeft
          ? advanceUntilDecision(reduce(state, nextHand()))
          : createTable(seats, chips, bigBlind, { seed: cliOptions.seed })
        continue
      }

      if (!isBettingDecision(state)) {
        continue
      }

      const action = await promptAction(state, rl)
      if (!action) break
      state = reduce(state, action)
    }
  } finally {
    rl.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
