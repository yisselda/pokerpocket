import { describe, it, expect } from 'vitest'
import { LcgRng } from '../src/rng.js'

describe('LcgRng', () => {
  it('generates identical sequences for the same seed', () => {
    const a = new LcgRng(1234)
    const b = new LcgRng(1234)

    const samplesA = Array.from({ length: 5 }, () => a.next())
    const samplesB = Array.from({ length: 5 }, () => b.next())

    expect(samplesA).toEqual(samplesB)
  })

  it('round-trips state with getState/setState', () => {
    const original = new LcgRng(99)
    // advance a few steps to capture a non-trivial snapshot
    original.next()
    original.next()
    const snapshot = original.getState()

    const resume = LcgRng.fromState(snapshot)

    const continuedOriginal = Array.from({ length: 5 }, () => original.next())
    const continuedResume = Array.from({ length: 5 }, () => resume.next())

    expect(continuedResume).toEqual(continuedOriginal)
  })

  it('keeps randInt outputs within range', () => {
    const rng = new LcgRng(2024)
    const rolls = Array.from({ length: 100 }, () => rng.randInt(10))

    rolls.forEach(value => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(10)
    })
    expect(new Set(rolls).size).toBeGreaterThan(1)
  })
})
