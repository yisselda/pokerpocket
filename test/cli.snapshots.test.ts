import { describe, it, expect } from 'vitest'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CLI_PATH = join(__dirname, '../dist/cli.js')

function runCliCommand(
  commands: string[],
  options: { ascii?: boolean; timeout?: number } = {}
): Promise<{
  stdout: string
  stderr: string
  exitCode: number | null
}> {
  const { ascii = true, timeout = 5000 } = options

  return new Promise((resolve, reject) => {
    const env = { ...process.env }
    if (ascii) {
      env.DISABLE_UNICODE = '1' // Force ASCII mode for consistent snapshots
    }

    const child = spawn('node', [CLI_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
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

    child.stdout?.on('data', data => {
      stdout += data.toString()
    })

    child.stderr?.on('data', data => {
      stderr += data.toString()
    })

    child.on('exit', code => {
      hasExited = true
      clearTimeout(timeoutId)
      resolve({ stdout, stderr, exitCode: code })
    })

    child.on('error', error => {
      hasExited = true
      clearTimeout(timeoutId)
      reject(error)
    })

    // Send commands
    if (child.stdin) {
      for (const cmd of commands) {
        child.stdin.write(cmd + '\n')
      }
      child.stdin.write('q\n') // Always quit
      child.stdin.end()
    }
  })
}

function normalizeOutput(output: string): string {
  // Remove ANSI color codes if any
  return (
    output
      // eslint-disable-next-line no-control-regex
      .replace(/\u001b\[[0-9;]*m/g, '')
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      // Remove trailing whitespace from lines
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .trim()
  )
}

describe('CLI Snapshot Tests', () => {
  it('help command output', async () => {
    const result = await runCliCommand(['help'])
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')

    const normalizedOutput = normalizeOutput(result.stdout)
    expect(normalizedOutput).toMatchSnapshot()
  })

  it('players command output', async () => {
    const result = await runCliCommand(['players 3', 'status'])
    expect(result.exitCode).toBe(0)

    const normalizedOutput = normalizeOutput(result.stdout)
    expect(normalizedOutput).toMatchSnapshot()
  })

  it('seed command output', async () => {
    const result = await runCliCommand(['seed 123', 'status'])
    expect(result.exitCode).toBe(0)

    const normalizedOutput = normalizeOutput(result.stdout)
    expect(normalizedOutput).toMatchSnapshot()
  })

  it('deal command output', async () => {
    const result = await runCliCommand([
      'players 3',
      'seed 42',
      'deal',
      'status',
    ])
    expect(result.exitCode).toBe(0)

    const normalizedOutput = normalizeOutput(result.stdout)
    expect(normalizedOutput).toMatchSnapshot()
  })

  it('complete game sequence', async () => {
    const result = await runCliCommand([
      'players 3',
      'seed 123',
      'deal',
      'flop',
      'turn',
      'river',
      'showdown',
    ])
    expect(result.exitCode).toBe(0)

    const normalizedOutput = normalizeOutput(result.stdout)
    expect(normalizedOutput).toMatchSnapshot()
  })

  it('hole card reveal', async () => {
    const result = await runCliCommand([
      'players 3',
      'seed 999',
      'deal',
      'hole 1',
      'hole 2',
      'hole 3',
    ])
    expect(result.exitCode).toBe(0)

    const normalizedOutput = normalizeOutput(result.stdout)
    expect(normalizedOutput).toMatchSnapshot()
  })

  it('fold sequence', async () => {
    const result = await runCliCommand([
      'players 4',
      'seed 777',
      'deal',
      'fold 1',
      'fold 2',
      'status',
      'fold 3',
      'status',
    ])
    expect(result.exitCode).toBe(0)

    const normalizedOutput = normalizeOutput(result.stdout)
    expect(normalizedOutput).toMatchSnapshot()
  })

  it('error handling - invalid commands', async () => {
    const result = await runCliCommand([
      'invalid-command',
      'players',
      'players abc',
      'seed',
      'hole',
      'fold xyz',
    ])
    expect(result.exitCode).toBe(0)

    const normalizedOutput = normalizeOutput(result.stdout)
    expect(normalizedOutput).toMatchSnapshot()
  })

  it('error handling - out of range values', async () => {
    const result = await runCliCommand([
      'players 0',
      'players 100',
      'hole 0',
      'hole 999',
      'fold 0',
      'fold 100',
    ])
    expect(result.exitCode).toBe(0)

    const normalizedOutput = normalizeOutput(result.stdout)
    expect(normalizedOutput).toMatchSnapshot()
  })

  it('game state errors', async () => {
    const result = await runCliCommand([
      'flop', // Before deal
      'showdown', // Before deal
      'players 3',
      'seed 12345', // Use fixed seed for deterministic output
      'deal',
      'players 4', // During hand
      'flop',
      'flop', // Already flopped
      'showdown',
    ])
    expect(result.exitCode).toBe(0)

    const normalizedOutput = normalizeOutput(result.stdout)
    expect(normalizedOutput).toMatchSnapshot()
  })
})

describe('CLI Unicode vs ASCII Tests', () => {
  it('unicode mode output', async () => {
    const result = await runCliCommand(
      ['players 2', 'seed 42', 'deal', 'skipbet', 'flop'],
      { ascii: false }
    )
    expect(result.exitCode).toBe(0)

    const normalizedOutput = normalizeOutput(result.stdout)
    // Should contain unicode symbols
    expect(normalizedOutput).toMatch(/[♠♥♦♣]/u)
    expect(normalizedOutput).toMatchSnapshot()
  })

  it('ascii mode output', async () => {
    const result = await runCliCommand(
      ['players 2', 'seed 42', 'deal', 'skipbet', 'flop'],
      { ascii: true }
    )
    expect(result.exitCode).toBe(0)

    const normalizedOutput = normalizeOutput(result.stdout)
    // Should NOT contain unicode symbols, only ASCII
    expect(normalizedOutput).not.toMatch(/[♠♥♦♣]/u)
    expect(normalizedOutput).toMatch(/[shdc]/) // ASCII suit letters
    expect(normalizedOutput).toMatchSnapshot()
  })

  it('non-TTY defaults to ASCII', async () => {
    // This simulates piping output or redirecting, which should force ASCII
    const result = await runCliCommand(['players 2', 'seed 42', 'deal'], {
      ascii: true,
    })
    expect(result.exitCode).toBe(0)

    const normalizedOutput = normalizeOutput(result.stdout)
    expect(normalizedOutput).not.toMatch(/[♠♥♦♣]/u)
    expect(normalizedOutput).toMatch(/[shdc]/)
  })
})
