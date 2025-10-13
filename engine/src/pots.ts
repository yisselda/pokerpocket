import type { Player, Pot } from './types.js'

/**
 * Move current street bets into pots, creating/expanding side pots.
 * Assumes player.bet is the amount they have committed this street
 * and player.contributed is lifetime in-hand contribution.
 */
export function settleStreetBets(
  players: Player[],
  pots: Pot[]
): { players: Player[]; pots: Pot[] } {
  const nextPlayers = players.map(p => ({ ...p }))
  const nextPots = [...pots]

  let bettors = collectActiveBettors(nextPlayers)

  while (bettors.length > 0) {
    const slice = peelNextSlice(bettors, nextPlayers)
    mergePot(nextPots, slice.eligibleSeatIds, slice.amount)
    bettors = cleanupBettors(bettors)
  }

  return { players: nextPlayers, pots: nextPots }
}

type ActiveBettor = { id: number; bet: number }

function collectActiveBettors(players: Player[]): ActiveBettor[] {
  return players
    .filter(p => !p.folded && p.bet > 0)
    .map(p => ({ id: p.id, bet: p.bet }))
    .sort((a, b) => a.bet - b.bet)
}

function peelNextSlice(
  bettors: ActiveBettor[],
  players: Player[]
): { eligibleSeatIds: number[]; amount: number } {
  const minBet = bettors[0].bet
  const eligibleSeatIds = bettors.map(b => b.id)
  let amount = 0

  for (const bettor of bettors) {
    const contribution = Math.min(bettor.bet, minBet)
    amount += contribution

    const player = players[bettor.id]
    player.bet -= contribution
    player.contributed += contribution

    bettor.bet -= contribution
  }

  return { eligibleSeatIds, amount }
}

function cleanupBettors(bettors: ActiveBettor[]): ActiveBettor[] {
  return bettors.filter(b => b.bet > 0).sort((a, b) => a.bet - b.bet)
}

function mergePot(
  pots: Pot[],
  eligibleSeatIds: number[],
  amount: number
): void {
  if (amount === 0) return

  const lastPot = pots[pots.length - 1]
  if (lastPot && sharesEligibility(lastPot.eligible, eligibleSeatIds)) {
    lastPot.amount += amount
    return
  }

  pots.push({ amount, eligible: eligibleSeatIds })
}

function sharesEligibility(a: number[], b: number[]): boolean {
  return eqSet(new Set(a), new Set(b))
}

function eqSet<A>(a: Set<A>, b: Set<A>) {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}
