#!/usr/bin/env node

import { createTable } from './dist/index.js'
import { initHand } from './dist/index.js'
import { processAction } from './dist/index.js'
import { isRoundComplete, advanceStreet } from './dist/index.js'
import { createDeck } from './dist/index.js'

// Create table with 4 players
let table = createTable({
  maxSeats: 6,
  players: [
    { id: 'p1', stack: 1000 },
    { id: 'p2', stack: 1000 },
    { id: 'p3', stack: 1000 },
    { id: 'p4', stack: 1000 },
  ],
  blinds: { sb: 10, bb: 20 },
  rng: createDeck(),
})

console.log('Starting all-in test with 4 players...')

// Start hand
table = initHand(table)
console.log(`Hand started. Street: ${table.street}`)

// Get action order
const getActingPlayer = () => table.seats.findIndex((s, i) => i === table.actionOn)

// P4 (UTG) goes all-in
if (getActingPlayer() === 3) {
  console.log('P4 going all-in...')
  table = processAction(table, {
    type: 'RAISE',
    seat: 3,
    to: table.seats[3].stack + table.seats[3].contributed,
  })
}

// P1 calls
const p1Index = 0
if (table.actionOn === p1Index) {
  console.log('P1 calling...')
  table = processAction(table, {
    type: 'CALL',
    seat: p1Index,
  })
}

// P2 calls
const p2Index = 1
if (table.actionOn === p2Index) {
  console.log('P2 calling...')
  table = processAction(table, {
    type: 'CALL',
    seat: p2Index,
  })
}

// P3 calls
const p3Index = 2
if (table.actionOn === p3Index) {
  console.log('P3 calling...')
  table = processAction(table, {
    type: 'CALL',
    seat: p3Index,
  })
}

console.log('All players all-in!')
console.log(`Current street: ${table.street}`)

// Check if round is complete
if (isRoundComplete(table)) {
  console.log('Round is complete, advancing streets...')

  let streetCount = 0
  while (table.street !== 'COMPLETE' && table.street !== 'SHOWDOWN' && streetCount < 10) {
    table = advanceStreet(table)
    console.log(`Advanced to: ${table.street}`)
    streetCount++
  }

  if (streetCount >= 10) {
    console.log('ERROR: Too many street advances - possible infinite loop!')
    process.exit(1)
  }
}

console.log(`\nFinal street: ${table.street}`)
console.log('Test completed successfully - no infinite loop!')

// Show winner if available
if (table.winners) {
  console.log('\nWinners:')
  table.winners.forEach(w => {
    const seatIdx = table.seats.findIndex(s => s.id === w.seatId)
    console.log(`  Player ${seatIdx + 1}: +${w.amount}`)
  })
}