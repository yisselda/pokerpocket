import { describe, it, expect } from 'vitest'
import { evaluateSevenCards } from '../src/evaluator'

describe('evaluator basics', () => {
  it('detects high card vs one pair', () => {
    const seven = ['As', 'Kd', '7c', '2s', '9h', '5d', '3c'] // A,K,9,7,5 high
    const res = evaluateSevenCards(seven)
    expect(res.category).toBe('HIGH_CARD')

    const withPair = ['As', 'Ad', '7c', '2s', '9h', '5d', '3c']
    const res2 = evaluateSevenCards(withPair)
    expect(res2.category).toBe('ONE_PAIR')
  })

  it('detects straight (wheel A-5)', () => {
    const wheel = ['As', '2d', '3c', '4h', '5s', '9d', 'Kd']
    const r = evaluateSevenCards(wheel)
    expect(r.category).toBe('STRAIGHT')
    // high should represent 5-high straight; our impl encodes ranks [3,2,1,0,12]
    expect(r.ranks[0]).toBe(3)
  })

  it('detects flush', () => {
    const flush = ['As', 'Qs', '8s', '4s', '2s', '9d', 'Kd']
    const r = evaluateSevenCards(flush)
    expect(r.category).toBe('FLUSH')
  })

  it('detects full house', () => {
    const fh = ['As', 'Ad', 'Ah', 'Kd', 'Kc', '2s', '3d'] // AAA KK
    const r = evaluateSevenCards(fh)
    expect(r.category).toBe('FULL_HOUSE')
  })

  it('detects straight flush', () => {
    const sf = ['9s', 'Ts', 'Js', 'Qs', 'Ks', '2d', '3c'] // 9..K straight flush
    const r = evaluateSevenCards(sf)
    expect(r.category).toBe('STRAIGHT_FLUSH')
  })
})
