import { describe, it, expect } from 'vitest'
import { execa } from 'execa'

describe('CLI E2E', () => {
  it('should produce stable output for a complete game session', async () => {
    const input = [
      'players 3',
      'seed 12345',
      'deal',
      'flop',
      'turn',
      'river',
      'showdown',
      'q',
    ].join('\n')

    const result = await execa('node', ['dist/cli.js'], {
      input,
      timeout: 5000,
    })

    expect(result.stdout).toMatchInlineSnapshot(`
      "🃏 Poker Pocket CLI
      Type "help" for commands
      Players: 2, Phase: IDLE
      Available: deal, players <n>

      > Players set to 3
      Players: 3, Phase: IDLE
      Available: deal, players <n>

      > Seed set to 12345 for next deal
      > Cards dealt!
      Players: 3, Phase: PREFLOP
      Hole: P1: 2 cards, P2: 2 cards, P3: 2 cards
      Available: flop, fold <player>

      > Flop dealt!
      Players: 3, Phase: FLOP
      Board: 5♦ 7❤ A❤
      Hole: P1: 2 cards, P2: 2 cards, P3: 2 cards
      Available: turn, showdown, fold <player>

      > Turn dealt!
      Players: 3, Phase: TURN
      Board: 5♦ 7❤ A❤ 4♦
      Hole: P1: 2 cards, P2: 2 cards, P3: 2 cards
      Available: river, showdown, fold <player>

      > River dealt!
      Players: 3, Phase: RIVER
      Board: 5♦ 7❤ A❤ 4♦ 6♠
      Hole: P1: 2 cards, P2: 2 cards, P3: 2 cards
      Available: showdown, fold <player>

      > 
      P1: 9♠ 4❤  ⇒  ONE PAIR (9♠,4❤,7❤,A❤,4♦)
      P2: Q❤ 8♣  ⇒  STRAIGHT (8♣,5♦,7❤,4♦,6♠)
      P3: 7♣ Q♣  ⇒  ONE PAIR (7♣,Q♣,7❤,A❤,6♠)

      Winner(s): P2

      Hand complete!

      P1: 9♠ 4❤  ⇒  ONE PAIR (9♠,4❤,7❤,A❤,4♦)
      P2: Q❤ 8♣  ⇒  STRAIGHT (8♣,5♦,7❤,4♦,6♠)
      P3: 7♣ Q♣  ⇒  ONE PAIR (7♣,Q♣,7❤,A❤,6♠)

      Winner(s): P2

      Board: 5♦ 7❤ A❤ 4♦ 6♠
      Available: deal (new hand), players <n>

      > Goodbye!"
    `)
  })

  it('should handle early showdown at flop', async () => {
    const input = ['seed 54321', 'deal', 'flop', 'showdown', 'q'].join('\n')

    const result = await execa('node', ['dist/cli.js'], {
      input,
      timeout: 5000,
    })

    // Verify it contains expected elements without full snapshot for this shorter test
    expect(result.stdout).toContain('Seed set to 54321 for next deal')
    expect(result.stdout).toContain('Flop dealt!')
    expect(result.stdout).toContain('Winner(s):')
    expect(result.stdout).toContain('Hand complete!')
    expect(result.stdout).toContain('Goodbye!')
  })

  it('should detect output changes (stability test)', async () => {
    // This test ensures that if game logic changes (e.g., different winner evaluation),
    // the snapshot will fail and need updating
    const input = [
      'players 3',
      'seed 12345',
      'deal',
      'flop',
      'turn',
      'river',
      'showdown',
      'q',
    ].join('\n')

    const result = await execa('node', ['dist/cli.js'], {
      input,
      timeout: 5000,
    })

    // Verify specific deterministic outcomes that should never change with seed 12345
    expect(result.stdout).toContain(
      'P2: Q❤ 8♣  ⇒  STRAIGHT (8♣,5♦,7❤,4♦,6♠)'
    )
    expect(result.stdout).toContain('Winner(s): P2')
    expect(result.stdout).toContain('Board: 5♦ 7❤ A❤ 4♦ 6♠')
  })

  it('should work without seed (random games)', async () => {
    // Test random gameplay without seed - should have different results each run
    const input = [
      'players 2',
      'deal',
      'flop',
      'turn',
      'river',
      'showdown',
      'q',
    ].join('\n')

    const result = await execa('node', ['dist/cli.js'], {
      input,
      timeout: 5000,
    })

    // Verify structure without specific content (since it's random)
    expect(result.stdout).toContain('🃏 Poker Pocket CLI')
    expect(result.stdout).toContain('Players set to 2')
    expect(result.stdout).toContain('Cards dealt!')
    expect(result.stdout).toContain('Flop dealt!')
    expect(result.stdout).toContain('Turn dealt!')
    expect(result.stdout).toContain('River dealt!')
    expect(result.stdout).toMatch(/P[12]: .+ ⇒ .+/) // Player results
    expect(result.stdout).toMatch(/(Winner\(s\): P[12]|Split: P[12],P[12])/) // Winner or tie announcement
    expect(result.stdout).toContain('Hand complete!')
    expect(result.stdout).toContain('Available: deal (new hand), players <n>')
    expect(result.stdout).toContain('Goodbye!')
  })

  it('should handle fold win scenario', async () => {
    const input = ['seed 99999', 'deal', 'fold 1', 'q'].join('\n')

    const result = await execa('node', ['dist/cli.js'], {
      input,
      timeout: 5000,
    })

    expect(result.stdout).toContain('P1 folds')
    expect(result.stdout).toContain('P2 wins! (All other players folded)')
    expect(result.stdout).toContain('Goodbye!')
  })
})
