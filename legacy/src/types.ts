export type Suit = 's' | 'h' | 'd' | 'c'
export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'T'
  | 'J'
  | 'Q'
  | 'K'
  | 'A'
export type Card = { rank: Rank; suit: Suit }
export type HandRank =
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
  rank: HandRank
  tiebreak: number[]
  score: bigint
  best5: Card[]
}
