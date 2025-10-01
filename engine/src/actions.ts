import type { Action, SeatId } from './types.js'

export const startHand = (): Action => ({ type: 'START' })
export const dealCards = (): Action => ({ type: 'DEAL_CARDS' })
export const endRound = (): Action => ({ type: 'ROUND_COMPLETE' })
export const toShowdown = (): Action => ({ type: 'SHOWDOWN' })
export const nextHand = (): Action => ({ type: 'NEXT_HAND' })

export const fold = (seat: SeatId): Action => ({
  type: 'PLAYER_ACTION',
  seat,
  move: 'FOLD',
})
export const check = (seat: SeatId): Action => ({
  type: 'PLAYER_ACTION',
  seat,
  move: 'CHECK',
})
export const call = (seat: SeatId): Action => ({
  type: 'PLAYER_ACTION',
  seat,
  move: 'CALL',
})
export const raiseTo = (seat: SeatId, amount: number): Action => ({
  type: 'PLAYER_ACTION',
  seat,
  move: 'RAISE',
  amount,
})
