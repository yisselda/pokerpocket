import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const [, , maybeTag, ...extraArgs] = process.argv
const tag = maybeTag ?? 'latest'
const engineDir = join(__dirname, '..', 'engine')

const args = ['publish', '--access', 'public']
if (tag && tag !== 'latest') {
  args.push('--tag', tag)
}
args.push(...extraArgs)

await execa('npm', args, {
  cwd: engineDir,
  stdio: 'inherit',
})
