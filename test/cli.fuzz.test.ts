import { describe, it, expect } from 'vitest'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CLI_PATH = join(__dirname, '../dist/cli.js')

// Pool of commands to fuzz with (mix of valid and invalid)
const COMMAND_POOL = [
  // Valid commands
  'help', 'deal', 'flop', 'turn', 'river', 'showdown', 'status',
  'players 2', 'players 5', 'players 9', 'seed 123', 'seed 999',
  'hole 1', 'hole 2', 'fold 1', 'fold 2', 'q',

  // Invalid commands
  'invalid', 'dealx', 'flopppp', 'xyz', 'unknown-command',
  'players', 'players 0', 'players 10', 'players abc',
  'seed', 'seed abc', 'seed -1',
  'hole', 'hole 0', 'hole 10', 'hole abc',
  'fold', 'fold 0', 'fold 10', 'fold abc',

  // Edge cases
  '', '   ', '\n', '\t', 'DEAL', 'Deal', 'HELP',
  'help extra args', 'status with args',
  'players 3 extra', 'seed 42 extra',

  // Special characters
  '!@#$%', '{}[]', '\\', '/', '"quotes"', "'quotes'",
  'cmd; echo hack', 'cmd | cat', 'cmd && echo',

  // Very long input
  'a'.repeat(1000),
  'very long command with many words '.repeat(50),
]

function spawnCliWithCommands(commands: string[], timeout = 5000): Promise<{
  stdout: string
  stderr: string
  exitCode: number | null
}> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, DISABLE_UNICODE: '1' } // Force ASCII mode for consistency
    })

    let stdout = ''
    let stderr = ''
    let hasExited = false

    const timeoutId = setTimeout(() => {
      if (!hasExited) {
        child.kill('SIGTERM')
        reject(new Error(`CLI process timed out after ${timeout}ms`))
      }
    }, timeout)

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('exit', (code) => {
      hasExited = true
      clearTimeout(timeoutId)
      resolve({ stdout, stderr, exitCode: code })
    })

    child.on('error', (error) => {
      hasExited = true
      clearTimeout(timeoutId)
      reject(error)
    })

    // Send commands
    if (child.stdin) {
      for (const cmd of commands) {
        child.stdin.write(cmd + '\n')
      }
      child.stdin.write('q\n') // Always quit at the end
      child.stdin.end()
    }
  })
}

describe('CLI Fuzz Testing', () => {
  it('handles random mix of valid and invalid commands gracefully', async () => {
    // Generate random sequence of commands
    const numCommands = 20
    const randomCommands = Array.from({ length: numCommands }, () => {
      const randomIndex = Math.floor(Math.random() * COMMAND_POOL.length)
      return COMMAND_POOL[randomIndex]
    })

    const result = await spawnCliWithCommands(randomCommands)

    // Should exit cleanly
    expect(result.exitCode).toBe(0)

    // Should not have stack traces in stderr
    expect(result.stderr).not.toMatch(/Error:.*at.*\(/i) // No stack traces
    expect(result.stderr).not.toMatch(/TypeError/i)
    expect(result.stderr).not.toMatch(/ReferenceError/i)
    expect(result.stderr).not.toMatch(/SyntaxError/i)

    // Should contain welcome message
    expect(result.stdout).toMatch(/Poker Pocket CLI/i)

    // Should contain help text for unknown commands
    if (randomCommands.some(cmd => !cmd.match(/^(help|deal|flop|turn|river|showdown|status|players \d+|seed \d+|hole \d+|fold \d+|q)$/))) {
      expect(result.stdout).toMatch(/Unknown command|Type "help"/i)
    }
  }, 10000) // 10 second timeout

  it('handles edge case inputs without crashing', async () => {
    const edgeCases = [
      '',           // Empty input
      '   ',        // Whitespace only
      '\n',         // Just newline
      '\t',         // Just tab
      'UPPERCASE',  // All caps
      'MiXeD cAsE', // Mixed case
      '!@#$%^&*()', // Special chars
      'cmd; rm -rf /', // Command injection attempt
      'x'.repeat(10000), // Very long input
    ]

    const result = await spawnCliWithCommands(edgeCases)

    expect(result.exitCode).toBe(0)
    expect(result.stderr).not.toMatch(/Error:.*at.*\(/i) // No stack traces
    expect(result.stdout).toMatch(/Poker Pocket CLI/i)
  }, 10000)

  it('handles malformed command arguments gracefully', async () => {
    const malformedCommands = [
      'players',     // Missing argument
      'players abc', // Non-numeric
      'players -1',  // Negative
      'players 0',   // Too small
      'players 100', // Too large
      'seed',        // Missing argument
      'seed xyz',    // Non-numeric
      'hole',        // Missing argument
      'hole abc',    // Non-numeric
      'hole -5',     // Negative
      'hole 999',    // Too large
      'fold',        // Missing argument
      'fold xyz',    // Non-numeric
    ]

    const result = await spawnCliWithCommands(malformedCommands)

    expect(result.exitCode).toBe(0)
    expect(result.stderr).not.toMatch(/Error:.*at.*\(/i) // No stack traces

    // Should contain usage information for malformed commands
    expect(result.stdout).toMatch(/Usage:/i)
    expect(result.stdout).toMatch(/Poker Pocket CLI/i)
  }, 10000)

  it('handles rapid command sequences without hanging', async () => {
    // Test rapid fire commands
    const rapidCommands = [
      'players 3', 'seed 42', 'deal', 'status', 'flop', 'status',
      'turn', 'status', 'river', 'status', 'showdown', 'status',
      'players 4', 'seed 999', 'deal', 'fold 1', 'fold 2', 'fold 3',
      'showdown', 'status'
    ]

    const result = await spawnCliWithCommands(rapidCommands, 8000)

    expect(result.exitCode).toBe(0)
    expect(result.stderr).not.toMatch(/Error:.*at.*\(/i) // No stack traces
    expect(result.stdout).toMatch(/Poker Pocket CLI/i)
  }, 10000)

  it('handles commands with extra arguments', async () => {
    const commandsWithExtraArgs = [
      'help extra arguments here',
      'deal with extra args',
      'flop extra',
      'status and more',
      'players 3 with extra stuff',
      'seed 123 extra data',
      'hole 1 more args',
      'fold 2 and more'
    ]

    const result = await spawnCliWithCommands(commandsWithExtraArgs)

    expect(result.exitCode).toBe(0)
    expect(result.stderr).not.toMatch(/Error:.*at.*\(/i) // No stack traces
    expect(result.stdout).toMatch(/Poker Pocket CLI/i)
  }, 10000)

  it('handles unicode and special characters', async () => {
    const unicodeCommands = [
      '🃏♠♥♦♣',     // Card symbols
      'çñüéà',       // Accented chars
      '中文测试',     // Chinese characters
      'Ñoñó',        // Spanish
      '한국어',       // Korean
      'العربية',     // Arabic
      '\\\\\\',      // Backslashes
      '"""',         // Quotes
      '```',         // Backticks
    ]

    const result = await spawnCliWithCommands(unicodeCommands)

    expect(result.exitCode).toBe(0)
    expect(result.stderr).not.toMatch(/Error:.*at.*\(/i) // No stack traces
    expect(result.stdout).toMatch(/Poker Pocket CLI/i)
  }, 10000)
})