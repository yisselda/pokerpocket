import { evaluateSeven } from './evaluator.js'
import type { Player, Pot } from './types.js'

// Determine the winners of the hand and their payouts
// For each pot, find best eligible hand among not-folded players
export function resolveShowdown(
  players: Player[],
  board: string[],
  pots: Pot[]
) {
  const payouts: { seatId: number; amount: number }[] = []

  for (const pot of pots) {
    let best = -Infinity
    let winners: number[] = []

    for (const seatId of pot.eligible) {
      const p = players[seatId]
      if (p.folded || !p.hole) continue
      const s = evaluateSeven(board, p.hole)
      if (s.score > best) {
        best = s.score
        winners = [p.id]
      } else if (s.score === best) {
        winners.push(p.id)
      }
    }

    if (winners.length === 0) continue
    const share = Math.floor(pot.amount / winners.length)
    for (const w of winners) payouts.push({ seatId: w, amount: share })
    // TODO: distribute remainder chips by house rule if needed
  }

  return payouts
}
