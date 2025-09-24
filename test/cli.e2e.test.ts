import { describe, it, expect } from 'vitest'
import { execa } from 'execa'

describe('CLI E2E', () => {
  it('should produce stable output for a complete game session', async () => {
    const input = [
      'players 3',
      'seed 12345',
      'deal',
      'skipbet',
      'flop',
      'skipbet',
      'turn',
      'skipbet',
      'river',
      'skipbet',
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
      Betting: ON | Blinds: 50/100 | Default stack: 10000
      Players: 2, Phase: IDLE
      Available: deal, players <n>

      > Players set to 3
      Players: 3, Phase: IDLE
      Available: deal, players <n>

      > Seed set to 12345 for next deal
      > Cards dealt! Blinds posted.
      Players: 3, Phase: PREFLOP

      💰 Pot: 150 | Current bet: 100
      Players:
        P1 (D): 10000 chips ← TO ACT
        P2: 9950 chips [50 in pot]
        P3: 9900 chips [100 in pot]
      P1 actions: fold, call, raise <amount> (200-10000), allin

      > Betting round auto-completed
      > Flop dealt!
      Players: 3, Phase: FLOP
      Board: 5♦ 7❤ A❤

      💰 Pot: 300
      Players:
        P1 (D): 9900 chips
        P2: 9900 chips
        P3: 9900 chips
      Available: turn, showdown, fold <player>

      > No active betting round
      > Turn dealt!
      Players: 3, Phase: TURN
      Board: 5♦ 7❤ A❤ 4♦

      💰 Pot: 300
      Players:
        P1 (D): 9900 chips
        P2: 9900 chips
        P3: 9900 chips
      Available: river, showdown, fold <player>

      > No active betting round
      > River dealt!
      Players: 3, Phase: RIVER
      Board: 5♦ 7❤ A❤ 4♦ 6♠

      💰 Pot: 300
      Players:
        P1 (D): 9900 chips
        P2: 9900 chips
        P3: 9900 chips
      Available: showdown, fold <player>

      > No active betting round
      > 
      P1: 9♠ 4❤  ⇒  ONE PAIR (9♠,4❤,7❤,A❤,4♦)
      P2: Q❤ 8♣  ⇒  STRAIGHT (8♣,5♦,7❤,4♦,6♠)
      P3: 7♣ Q♣  ⇒  ONE PAIR (7♣,Q♣,7❤,A❤,6♠)

      Winner(s): P2


      💰 Pot Distribution:
        P2 wins 300 chips

      Final Stacks:
        P1: 9900 chips
        P2: 10200 chips
        P3: 9900 chips
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
    const input = [
      'seed 54321',
      'deal',
      'skipbet',
      'flop',
      'skipbet',
      'showdown',
      'q',
    ].join('\n')

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
      'skipbet',
      'flop',
      'skipbet',
      'turn',
      'skipbet',
      'river',
      'skipbet',
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
      'skipbet',
      'flop',
      'skipbet',
      'turn',
      'skipbet',
      'river',
      'skipbet',
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
    const input = ['seed 99999', 'deal', 'fold', 'q'].join('\n')

    const result = await execa('node', ['dist/cli.js'], {
      input,
      timeout: 5000,
    })

    expect(result.stdout).toContain('folds')
    expect(result.stdout).toContain('wins the pot!')
    expect(result.stdout).toContain('Goodbye!')
  })
})
