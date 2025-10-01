import type { Player, Pot } from './types'

// TODO: wire to your existing evaluator:
// import { evaluateSeven } from "../../evaluator"; // adapt the path as needed

// Minimal stub scoring that ranks by lexicographic hole for now.
// Replace with your real evaluateSeven(board, hole) => numeric strength.
function scoreHand(board: string[], hole: [string, string]): number {
  return hole[0].charCodeAt(0) + hole[1].charCodeAt(0)
}

export function resolveShowdown(
  players: Player[],
  board: string[],
  pots: Pot[]
) {
  // For each pot, find best eligible hand among not-folded players
  const payouts: { seatId: number; amount: number }[] = []

  for (const pot of pots) {
    let best = -Infinity
    let winners: number[] = []

    for (const seatId of pot.eligible) {
      const p = players[seatId]
      if (p.folded || !p.hole) continue
      const s = scoreHand(board, p.hole)
      if (s > best) {
        best = s
        winners = [p.id]
      } else if (s === best) {
        winners.push(p.id)
      }
    }

    if (winners.length === 0) continue
    const share = Math.floor(pot.amount / winners.length)
    for (const w of winners) payouts.push({ seatId: w, amount: share })
    // Note: remainder chips (if any) could be assigned by house rules (first to left of button etc.)
  }

  return payouts
}
