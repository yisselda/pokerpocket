/** Ranks: 2..A => 0..12 (A=12) */
const RANK_CHARS = '23456789TJQKA'
const SUIT_CHARS = 'shdc' // s h d c

function rankOf(card: string): number {
  const r = card[0]
  const idx = RANK_CHARS.indexOf(r)
  if (idx < 0) throw new Error(`Bad rank: ${card}`)
  return idx
}
function suitOf(card: string): number {
  const s = card[1]
  const idx = SUIT_CHARS.indexOf(s)
  if (idx < 0) throw new Error(`Bad suit: ${card}`)
  return idx
}

export type HandCategory =
  | 'STRAIGHT_FLUSH'
  | 'FOUR_OF_A_KIND'
  | 'FULL_HOUSE'
  | 'FLUSH'
  | 'STRAIGHT'
  | 'THREE_OF_A_KIND'
  | 'TWO_PAIR'
  | 'ONE_PAIR'
  | 'HIGH_CARD'

export interface EvalResult {
  category: HandCategory
  score: number // higher is better
  ranks: number[] // 5 ranks high->low used to rank within category
}

/** Category strength (higher is better) */
function catValue(cat: HandCategory): number {
  switch (cat) {
    case 'STRAIGHT_FLUSH':
      return 9
    case 'FOUR_OF_A_KIND':
      return 8
    case 'FULL_HOUSE':
      return 7
    case 'FLUSH':
      return 6
    case 'STRAIGHT':
      return 5
    case 'THREE_OF_A_KIND':
      return 4
    case 'TWO_PAIR':
      return 3
    case 'ONE_PAIR':
      return 2
    case 'HIGH_CARD':
      return 1
  }
}

/** Pack up to 5 ranks (13-base) into an integer (high->low) */
function pack13(ranks: number[]): number {
  let v = 0
  for (let i = 0; i < 5; i++) {
    const r = ranks[i] ?? 0
    v = v * 13 + r
  }
  return v
}

function makeScore(cat: HandCategory, fiveRanksDesc: number[]): number {
  return (catValue(cat) << 20) | pack13(fiveRanksDesc)
}

function bit(rank: number) {
  return 1 << rank
}

/** Find highest straight high-card in a 13-bit mask; handles wheel (A-5). Returns high rank or -1. */
function findStraightHigh(mask: number): number {
  // normalize: if Ace present, also treat as rank -1 for wheel -> add bit at -1 by mapping to 0..12:
  // We'll explicitly check wheel: A,2,3,4,5 => bits (12,0,1,2,3)
  const hasA = (mask & bit(12)) !== 0
  // scan from A down to 5-high
  for (let high = 12; high >= 4; high--) {
    const need = bit(high) & mask
    if (!need) continue
    let ok = true
    for (let k = 1; k < 5; k++) {
      const r = high - k
      if ((mask & bit(r)) === 0) {
        ok = false
        break
      }
    }
    if (ok) return high
  }
  // wheel check: A-5
  if (
    hasA &&
    mask & bit(0) &&
    mask & bit(1) &&
    mask & bit(2) &&
    mask & bit(3)
  ) {
    return 3 // treat 5-high straight as high=3 (i.e., '5')
  }
  return -1
}

/** From a rank mask, pick top N ranks (desc). */
function topNRanks(mask: number, n: number, exclude: number[] = []): number[] {
  const ex = new Set(exclude)
  const out: number[] = []
  for (let r = 12; r >= 0 && out.length < n; r--) {
    if (ex.has(r)) continue
    if (mask & bit(r)) out.push(r)
  }
  return out
}

/** Build bitmasks and counts for 7 cards */
function buildMasks(cards7: string[]) {
  let rankMask = 0
  const suitMasks = [0, 0, 0, 0]
  const rankCounts = new Array(13).fill(0)
  const suitCounts = [0, 0, 0, 0]

  for (const c of cards7) {
    const r = rankOf(c)
    const s = suitOf(c)
    rankMask |= bit(r)
    suitMasks[s] |= bit(r)
    rankCounts[r]++
    suitCounts[s]++
  }
  return { rankMask, suitMasks, rankCounts, suitCounts }
}

/** Return all ranks with a specific count, desc (e.g., count=2 gives all pair ranks) */
function ranksWithCount(rankCounts: number[], count: number): number[] {
  const out: number[] = []
  for (let r = 12; r >= 0; r--) if (rankCounts[r] === count) out.push(r)
  return out
}

/** Evaluate best 5-card hand from 7 cards. */
export function evaluateSevenCards(cards7: string[]): EvalResult {
  if (cards7.length !== 7) throw new Error('evaluateSevenCards expects 7 cards')
  const { rankMask, suitMasks, rankCounts, suitCounts } = buildMasks(cards7)

  // 1) Straight Flush
  for (let s = 0; s < 4; s++) {
    if (suitCounts[s] >= 5) {
      const m = suitMasks[s]
      const hi = findStraightHigh(m)
      if (hi >= 0) {
        const ranks = [hi, hi - 1, hi - 2, hi - 3, hi - 4].map(x =>
          x >= 0 ? x : x === -1 ? 12 : x
        )
        // wheel correction: if hi==3 and A present in this suit, the sequence is 5,4,3,2,A -> represent ranks as [3,2,1,0,12]
        if (hi === 3 && m & bit(12)) {
          const wheel = [3, 2, 1, 0, 12]
          return {
            category: 'STRAIGHT_FLUSH',
            score: makeScore('STRAIGHT_FLUSH', wheel),
            ranks: wheel,
          }
        }
        return {
          category: 'STRAIGHT_FLUSH',
          score: makeScore('STRAIGHT_FLUSH', ranks),
          ranks,
        }
      }
    }
  }

  // 2) Four of a kind
  const quads = ranksWithCount(rankCounts, 4)
  if (quads.length > 0) {
    const q = quads[0]
    const kicker = topNRanks(rankMask, 1, [q])[0]
    const ranks = [q, q, q, q, kicker]
    return {
      category: 'FOUR_OF_A_KIND',
      score: makeScore('FOUR_OF_A_KIND', [q, kicker, 0, 0, 0]),
      ranks,
    }
  }

  // 3) Full house
  const trips = ranksWithCount(rankCounts, 3)
  const pairs = ranksWithCount(rankCounts, 2)
  if (trips.length > 0 && (pairs.length > 0 || trips.length > 1)) {
    const t = trips[0]
    const secondTripAsPair = trips.length > 1 ? trips[1] : -1
    const p = pairs[0] ?? secondTripAsPair
    const ranks = [t, t, t, p, p]
    return {
      category: 'FULL_HOUSE',
      score: makeScore('FULL_HOUSE', [t, p, 0, 0, 0]),
      ranks,
    }
  }

  // 4) Flush
  for (let s = 0; s < 4; s++) {
    if (suitCounts[s] >= 5) {
      const m = suitMasks[s]
      const five = topNRanks(m, 5)
      return { category: 'FLUSH', score: makeScore('FLUSH', five), ranks: five }
    }
  }

  // 5) Straight
  {
    const hi = findStraightHigh(rankMask)
    if (hi >= 0) {
      if (hi === 3 && rankMask & bit(12)) {
        const wheel = [3, 2, 1, 0, 12]
        return {
          category: 'STRAIGHT',
          score: makeScore('STRAIGHT', wheel),
          ranks: wheel,
        }
      }
      const ranks = [hi, hi - 1, hi - 2, hi - 3, hi - 4]
      return {
        category: 'STRAIGHT',
        score: makeScore('STRAIGHT', ranks),
        ranks,
      }
    }
  }

  // 6) Three of a kind
  if (trips.length > 0) {
    const t = trips[0]
    const kickers = topNRanks(rankMask, 2, [t])
    const ranks = [t, t, t, ...kickers]
    return {
      category: 'THREE_OF_A_KIND',
      score: makeScore('THREE_OF_A_KIND', [t, ...kickers]),
      ranks,
    }
  }

  // 7) Two pair
  if (pairs.length > 1) {
    const [p1, p2] = pairs.slice(0, 2)
    const hi = Math.max(p1, p2),
      lo = Math.min(p1, p2)
    const kicker = topNRanks(rankMask, 1, [hi, lo])[0]
    const ranks = [hi, hi, lo, lo, kicker]
    return {
      category: 'TWO_PAIR',
      score: makeScore('TWO_PAIR', [hi, lo, kicker, 0, 0]),
      ranks,
    }
  }

  // 8) One pair
  if (pairs.length > 0) {
    const p = pairs[0]
    const kickers = topNRanks(rankMask, 3, [p])
    const ranks = [p, p, ...kickers]
    return {
      category: 'ONE_PAIR',
      score: makeScore('ONE_PAIR', [p, ...kickers]),
      ranks,
    }
  }

  // 9) High card
  const highs = topNRanks(rankMask, 5)
  return {
    category: 'HIGH_CARD',
    score: makeScore('HIGH_CARD', highs),
    ranks: highs,
  }
}

/** Convenience helpers for engine usage */
export function evaluateSeven(
  board: string[],
  hole: [string, string]
): EvalResult {
  return evaluateSevenCards([...board, hole[0], hole[1]])
}
