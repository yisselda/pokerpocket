/**
 * No-Limit Hold'em betting layer for pokerpocket
 *
 * Augments existing PokerEngine - handles only betting logic while engine manages cards/phases.
 * Min-raise logic: minRaise = Math.max(bigBlind, lastRaise)
 * Side-pot layering: Sort players by committed amounts and peel off layers O(n log n)
 */

export type BetType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'

export interface TableConfig {
  smallBlind: number
  bigBlind: number
  ante?: number
  maxPlayers?: number
}

export interface BettingState {
  players: {
    stack: number
    committed: number
    totalCommitted: number
    hasFolded: boolean
    isAllIn: boolean
  }[]
  buttonIndex: number
  actingIndex: number
  currentBet: number
  lastRaise: number
  minRaise: number
  pots: Pot[]
}

export interface Pot {
  amount: number
  eligiblePlayers: number[]
}

export interface Action {
  player: number
  type: BetType
  amount?: number
}

function cloneState(state: BettingState): BettingState {
  return {
    ...state,
    players: state.players.map(p => ({ ...p })),
    pots: state.pots.map(p => ({ ...p, eligiblePlayers: [...p.eligiblePlayers] }))
  }
}

export function initBetting(
  playerCount: number,
  stacks: number[],
  buttonIndex: number
): BettingState {
  if (stacks.length !== playerCount) {
    throw new Error('Stack array length must match player count')
  }

  return {
    players: stacks.map(stack => ({
      stack,
      committed: 0,
      totalCommitted: 0,
      hasFolded: false,
      isAllIn: false
    })),
    buttonIndex,
    actingIndex: (buttonIndex + 1) % playerCount,
    currentBet: 0,
    lastRaise: 0,
    minRaise: 0,
    pots: []
  }
}

export function initBettingWithDefaults(
  playerCount: number,
  buttonIndex: number,
  defaultStack: number = 10000
): BettingState {
  const stacks = Array(playerCount).fill(defaultStack)
  return initBetting(playerCount, stacks, buttonIndex)
}

export function postBlinds(state: BettingState, config: TableConfig): BettingState {
  const newState = cloneState(state)
  const n = newState.players.length

  // Post antes if configured
  if (config.ante && config.ante > 0) {
    for (const player of newState.players) {
      const ante = Math.min(config.ante, player.stack)
      player.stack -= ante
      player.committed += ante
      player.totalCommitted += ante
      if (player.stack === 0) player.isAllIn = true
    }
  }

  // For heads-up: button posts SB, other player posts BB
  // For 3+: left of button posts SB, next posts BB
  let sbIndex: number
  let bbIndex: number

  if (n === 2) {
    sbIndex = newState.buttonIndex
    bbIndex = (newState.buttonIndex + 1) % n
  } else {
    sbIndex = (newState.buttonIndex + 1) % n
    bbIndex = (newState.buttonIndex + 2) % n
  }

  // Post small blind
  const sbPlayer = newState.players[sbIndex]
  const sbAmount = Math.min(config.smallBlind, sbPlayer.stack)
  sbPlayer.stack -= sbAmount
  sbPlayer.committed += sbAmount
  sbPlayer.totalCommitted += sbAmount
  if (sbPlayer.stack === 0) sbPlayer.isAllIn = true

  // Post big blind
  const bbPlayer = newState.players[bbIndex]
  const bbAmount = Math.min(config.bigBlind, bbPlayer.stack)
  bbPlayer.stack -= bbAmount
  bbPlayer.committed += bbAmount
  bbPlayer.totalCommitted += bbAmount
  if (bbPlayer.stack === 0) bbPlayer.isAllIn = true

  // Set betting state
  newState.currentBet = Math.max(sbAmount, bbAmount)
  newState.lastRaise = config.bigBlind
  newState.minRaise = config.bigBlind

  // First to act: left of BB for preflop
  newState.actingIndex = (bbIndex + 1) % n

  return newState
}

export function legalActions(state: BettingState, player: number): { type: BetType; min?: number; max?: number }[] {
  if (player < 0 || player >= state.players.length) {
    throw new Error(`Invalid player index: ${player}`)
  }

  const p = state.players[player]
  if (p.hasFolded || p.isAllIn) return []

  const actions: { type: BetType; min?: number; max?: number }[] = [{ type: 'fold' }]
  const toCall = state.currentBet - p.committed
  const canCall = Math.min(toCall, p.stack)

  if (toCall === 0) {
    // Can check
    actions.push({ type: 'check' })

    // Can bet if has chips
    if (p.stack > 0) {
      const minBet = state.minRaise
      const maxBet = p.stack
      if (minBet <= maxBet) {
        actions.push({ type: 'bet', min: minBet, max: maxBet })
      }
      actions.push({ type: 'allin' })
    }
  } else {
    // Must call or fold
    if (canCall > 0) {
      if (canCall < toCall) {
        // Can only go all-in
        actions.push({ type: 'allin' })
      } else {
        actions.push({ type: 'call' })

        // Can raise if has enough chips
        const minRaiseTotal = state.currentBet + state.minRaise
        const playerTotal = p.committed + p.stack

        if (minRaiseTotal <= playerTotal) {
          const minRaiseAmount = minRaiseTotal - p.committed
          const maxRaiseAmount = p.stack
          actions.push({ type: 'raise', min: minRaiseAmount, max: maxRaiseAmount })
        }

        if (p.stack > toCall) {
          actions.push({ type: 'allin' })
        }
      }
    }
  }

  return actions
}

export function applyAction(state: BettingState, action: Action): BettingState {
  const newState = cloneState(state)
  const player = newState.players[action.player]

  if (!player) {
    throw new Error(`Invalid player index: ${action.player}`)
  }

  switch (action.type) {
    case 'fold':
      player.hasFolded = true
      break

    case 'check':
      break

    case 'call': {
      const toCall = Math.min(newState.currentBet - player.committed, player.stack)
      player.stack -= toCall
      player.committed += toCall
      player.totalCommitted += toCall
      if (player.stack === 0) player.isAllIn = true
      break
    }

    case 'bet': {
      if (!action.amount) throw new Error('Bet amount required')
      if (action.amount > player.stack) throw new Error('Bet exceeds stack')

      player.stack -= action.amount
      player.committed += action.amount
      player.totalCommitted += action.amount
      newState.currentBet = player.committed
      newState.lastRaise = action.amount
      newState.minRaise = Math.max(newState.minRaise, action.amount)

      if (player.stack === 0) player.isAllIn = true
      break
    }

    case 'raise': {
      if (!action.amount) throw new Error('Raise amount required')
      if (action.amount > player.stack) throw new Error('Raise exceeds stack')

      const prevBet = newState.currentBet
      player.stack -= action.amount
      player.committed += action.amount
      player.totalCommitted += action.amount
      newState.currentBet = player.committed
      newState.lastRaise = newState.currentBet - prevBet
      newState.minRaise = Math.max(newState.minRaise, newState.lastRaise)

      if (player.stack === 0) player.isAllIn = true
      break
    }

    case 'allin':
      player.totalCommitted += player.stack
      player.committed += player.stack
      if (player.committed > newState.currentBet) {
        const raise = player.committed - newState.currentBet
        newState.lastRaise = raise
        newState.currentBet = player.committed
        newState.minRaise = Math.max(newState.minRaise, raise)
      }
      player.stack = 0
      player.isAllIn = true
      break
  }

  // Move to next active player
  const n = newState.players.length
  let nextIdx = (action.player + 1) % n
  let attempts = 0

  while (attempts < n) {
    const nextPlayer = newState.players[nextIdx]
    if (!nextPlayer.hasFolded && !nextPlayer.isAllIn) {
      newState.actingIndex = nextIdx
      break
    }
    nextIdx = (nextIdx + 1) % n
    attempts++
  }

  return newState
}

export function isRoundComplete(state: BettingState): boolean {
  const activePlayers = state.players.filter(p => !p.hasFolded && !p.isAllIn)

  // No active players remaining
  if (activePlayers.length === 0) return true

  // Only one player left (others folded)
  const nonFoldedPlayers = state.players.filter(p => !p.hasFolded)
  if (nonFoldedPlayers.length <= 1) return true

  // All active players have matched current bet
  for (const player of activePlayers) {
    if (player.committed < state.currentBet) return false
  }

  return true
}

export function startNewRound(state: BettingState): BettingState {
  const newState = cloneState(state)

  // Build pots from current round
  newState.pots = buildPots(newState.players)

  // Reset for new betting round
  for (const player of newState.players) {
    player.committed = 0
  }

  newState.currentBet = 0
  newState.lastRaise = newState.minRaise

  // Set first to act (left of button for post-flop)
  const n = newState.players.length
  let firstToAct = (newState.buttonIndex + 1) % n
  let attempts = 0

  while (attempts < n) {
    const player = newState.players[firstToAct]
    if (!player.hasFolded && !player.isAllIn) {
      newState.actingIndex = firstToAct
      break
    }
    firstToAct = (firstToAct + 1) % n
    attempts++
  }

  return newState
}

export function buildPots(players: { totalCommitted: number; hasFolded: boolean }[]): Pot[] {
  const pots: Pot[] = []
  const activePlayers = players
    .map((p, i) => ({ ...p, index: i }))
    .filter(p => !p.hasFolded && p.totalCommitted > 0)

  if (activePlayers.length === 0) return pots

  // Sort by total committed amount
  const sorted = [...activePlayers].sort((a, b) => a.totalCommitted - b.totalCommitted)

  let prevCommitted = 0
  for (let i = 0; i < sorted.length; i++) {
    const currentCommitted = sorted[i].totalCommitted
    const potContribution = currentCommitted - prevCommitted

    if (potContribution > 0) {
      const eligiblePlayers = sorted.slice(i).map(p => p.index)
      const potAmount = potContribution * eligiblePlayers.length

      // Add contributions from folded players
      const foldedContribution = players
        .map((p, idx) => ({ ...p, index: idx }))
        .filter(p => p.hasFolded && p.totalCommitted > prevCommitted)
        .reduce((sum, p) => sum + Math.min(potContribution, p.totalCommitted - prevCommitted), 0)

      pots.push({
        amount: potAmount + foldedContribution,
        eligiblePlayers: eligiblePlayers
      })
    }

    prevCommitted = currentCommitted
  }

  return pots
}

export function distributePots(
  state: BettingState,
  winners: number[]
): { player: number; amount: number }[] {
  const finalPots = buildPots(state.players)
  const distribution: { player: number; amount: number }[] = []

  for (const pot of finalPots) {
    const eligibleWinners = winners.filter(w => pot.eligiblePlayers.includes(w))

    if (eligibleWinners.length > 0) {
      const amountEach = Math.floor(pot.amount / eligibleWinners.length)

      for (const winner of eligibleWinners) {
        const existing = distribution.find(d => d.player === winner)
        if (existing) {
          existing.amount += amountEach
        } else {
          distribution.push({ player: winner, amount: amountEach })
        }
      }
    }
  }

  return distribution
}

export function getActivePlayers(state: BettingState): number[] {
  return state.players
    .map((p, i) => p.hasFolded ? -1 : i)
    .filter(i => i !== -1)
}

export function getTotalPot(state: BettingState): number {
  return state.players.reduce((sum, p) => sum + p.totalCommitted, 0)
}