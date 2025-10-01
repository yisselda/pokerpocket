import { TableState, ActionEvent, Seat } from '../betting/types.js'

/**
 * Initializes a new hand - deals cards, posts blinds, sets positions
 */
export function initHand(state: TableState): TableState {
  // Reset RNG deck if it has a reset method
  if (
    state.config.rng &&
    'reset' in state.config.rng &&
    typeof state.config.rng.reset === 'function'
  ) {
    ;(state.config.rng as any).reset()
  }

  // Create a new state object (immutable)
  const newState: TableState = {
    ...state,
    handId: state.handId + 1,
    board: [],
    pots: [],
    currentBet: 0,
    lastRaiseSize: 0,
    bettingReopened: true,
    hasActedThisRound: new Set<number>(),
    street: 'PREFLOP',
    winners: undefined,
    history: [...state.history],
    seats: state.seats.map(seat => ({
      ...seat,
      hole: undefined,
      contributed: 0,
      streetContributed: 0,
      folded: false,
      allIn: false,
    })),
  }

  // Count active seats (occupied and with chips)
  const activeSeats = newState.seats.filter(
    s => s.id !== '' && s.stack > 0
  ).length
  if (activeSeats < 2) {
    throw new Error('Need at least 2 players with chips to start hand')
  }

  // Move button if this is not the first hand
  if (state.handId > 0) {
    // Find next active seat after current button
    let nextButton = (state.button + 1) % state.config.maxSeats
    while (
      newState.seats[nextButton].id === '' ||
      newState.seats[nextButton].stack === 0
    ) {
      nextButton = (nextButton + 1) % state.config.maxSeats
    }
    newState.button = nextButton
  } else {
    // First hand - find first active seat
    let firstActive = 0
    while (
      newState.seats[firstActive].id === '' ||
      newState.seats[firstActive].stack === 0
    ) {
      firstActive++
    }
    newState.button = firstActive
  }

  // Determine SB and BB positions
  const isHeadsUp = activeSeats === 2

  if (isHeadsUp) {
    // Heads-up: button posts SB, other posts BB
    newState.sbIndex = newState.button

    // Find the other active player for BB
    let bbIdx = (newState.button + 1) % state.config.maxSeats
    while (
      newState.seats[bbIdx].id === '' ||
      newState.seats[bbIdx].stack === 0
    ) {
      bbIdx = (bbIdx + 1) % state.config.maxSeats
    }
    newState.bbIndex = bbIdx
  } else {
    // 3+ players: SB is left of button, BB is left of SB
    let sbIdx = (newState.button + 1) % state.config.maxSeats
    while (
      newState.seats[sbIdx].id === '' ||
      newState.seats[sbIdx].stack === 0
    ) {
      sbIdx = (sbIdx + 1) % state.config.maxSeats
    }
    newState.sbIndex = sbIdx

    let bbIdx = (sbIdx + 1) % state.config.maxSeats
    while (
      newState.seats[bbIdx].id === '' ||
      newState.seats[bbIdx].stack === 0
    ) {
      bbIdx = (bbIdx + 1) % state.config.maxSeats
    }
    newState.bbIndex = bbIdx
  }

  // Post antes if configured (only for active players)
  if (state.config.ante && state.config.ante > 0) {
    for (let i = 0; i < newState.seats.length; i++) {
      const seat = newState.seats[i]
      if (seat.id !== '' && seat.stack > 0) {
        const ante = Math.min(state.config.ante, seat.stack)
        seat.stack -= ante
        seat.contributed += ante
        // Don't count ante towards streetContributed for betting purposes
        if (seat.stack === 0) {
          seat.allIn = true
        }
      }
    }
  }

  // Post small blind
  const sbSeat = newState.seats[newState.sbIndex]
  const sbAmount = Math.min(state.config.blinds.sb, sbSeat.stack)
  sbSeat.stack -= sbAmount
  sbSeat.contributed += sbAmount
  sbSeat.streetContributed += sbAmount
  if (sbSeat.stack === 0) {
    sbSeat.allIn = true
  }

  // Post big blind
  const bbSeat = newState.seats[newState.bbIndex]
  const bbAmount = Math.min(state.config.blinds.bb, bbSeat.stack)
  bbSeat.stack -= bbAmount
  bbSeat.contributed += bbAmount
  bbSeat.streetContributed += bbAmount
  if (bbSeat.stack === 0) {
    bbSeat.allIn = true
  }

  // Add POST events for blinds
  const sbPostEvent: ActionEvent = {
    at: newState.history.length,
    seat: newState.sbIndex,
    kind: 'POST',
    data: { amount: sbAmount, type: 'SB' },
  }
  newState.history.push(sbPostEvent)

  const bbPostEvent: ActionEvent = {
    at: newState.history.length,
    seat: newState.bbIndex,
    kind: 'POST',
    data: { amount: bbAmount, type: 'BB' },
  }
  newState.history.push(bbPostEvent)

  // Set current bet to the highest blind contribution (not including antes)
  newState.currentBet = Math.max(
    sbSeat.streetContributed,
    bbSeat.streetContributed
  )
  newState.lastRaiseSize = state.config.blinds.bb

  // Deal hole cards to each active seat (only players with chips)
  if (state.config.rng) {
    const cardsNeeded = activeSeats * 2
    const dealtCards = state.config.rng.draw(cardsNeeded)
    let cardIndex = 0

    for (let i = 0; i < newState.seats.length; i++) {
      if (newState.seats[i].id !== '' && newState.seats[i].stack > 0) {
        newState.seats[i].hole = [
          dealtCards[cardIndex],
          dealtCards[cardIndex + 1],
        ] as [any, any]
        cardIndex += 2
      }
    }
  }

  // Set first to act
  if (isHeadsUp) {
    // Heads-up preflop: SB/button acts first
    newState.actionOn = newState.sbIndex
  } else {
    // 3+ players: UTG (left of BB) acts first
    let utgIdx = (newState.bbIndex + 1) % state.config.maxSeats
    while (newState.seats[utgIdx].id === '' || newState.seats[utgIdx].allIn) {
      utgIdx = (utgIdx + 1) % state.config.maxSeats
      // Prevent infinite loop if all are all-in
      if (utgIdx === newState.bbIndex) {
        break
      }
    }
    newState.actionOn = utgIdx
  }

  // Add START_HAND event to history
  const event: ActionEvent = {
    at: newState.history.length,
    kind: 'START_HAND',
    data: {
      handId: newState.handId,
      button: newState.button,
      sbIndex: newState.sbIndex,
      bbIndex: newState.bbIndex,
    },
  }
  newState.history.push(event)

  return newState
}
