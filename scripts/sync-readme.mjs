import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const rootReadme = join(__dirname, '..', 'README.md')
const engineReadme = join(__dirname, '..', 'engine', 'README.md')

const contents = await readFile(rootReadme, 'utf8')
await writeFile(engineReadme, contents)

console.log('Synced README.md -> engine/README.md')
