import { shuffleDeck } from './deck'
import type { Player, BettingPhase } from './types'

// deal 2 hole cards per active player (no burn logic yet)
export function dealHole(players: Player[], deck: string[]) {
  const nextPlayers = players.map(p => ({ ...p }))
  const nextDeck = [...deck]

  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < nextPlayers.length; i++) {
      const card = nextDeck.pop()
      if (!card) throw new Error('Deck underflow dealing hole')
      const existing = nextPlayers[i].hole
      const hole: string[] = existing ? [...existing] : []
      hole.push(card)
      nextPlayers[i].hole = hole as [string, string]
    }
  }
  return { players: nextPlayers, deck: nextDeck }
}

export function dealCommunity(
  board: string[],
  deck: string[],
  phase: BettingPhase
) {
  const nextBoard = [...board]
  const nextDeck = [...deck]

  // (Optional burn) // nextDeck.pop();
  if (phase === 'PREFLOP') {
    // FLOP
    for (let i = 0; i < 3; i++) {
      const c = nextDeck.pop()
      if (!c) throw new Error('Deck underflow dealing flop')
      nextBoard.push(c)
    }
  } else {
    // TURN or RIVER (single card)
    const c = nextDeck.pop()
    if (!c) throw new Error('Deck underflow dealing turn/river')
    nextBoard.push(c)
  }

  return { board: nextBoard, deck: nextDeck }
}
