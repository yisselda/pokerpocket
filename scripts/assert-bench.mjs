#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [, , baselinePathArg, currentPathArg, toleranceArg] = process.argv

if (!baselinePathArg || !currentPathArg) {
  console.error('Usage: node scripts/assert-bench.mjs <baseline.json> <current.json> [tolerance]')
  process.exit(1)
}

const baselinePath = resolve(baselinePathArg)
const currentPath = resolve(currentPathArg)
const tolerance = toleranceArg ? Number(toleranceArg) : 0.05

if (Number.isNaN(tolerance) || tolerance < 0) {
  console.error('Tolerance must be a non-negative number')
  process.exit(1)
}

function extractMap(json) {
  if (!json) return {}

  if (Array.isArray(json.files)) {
    const out = {}
    for (const file of json.files ?? []) {
      for (const group of file.groups ?? []) {
        for (const bench of group.benchmarks ?? []) {
          if (typeof bench.name === 'string' && typeof bench.hz === 'number') {
            out[bench.name] = bench.hz
          }
        }
      }
    }
    return out
  }

  if (Array.isArray(json.benchmarks)) {
    const out = {}
    for (const entry of json.benchmarks) {
      if (typeof entry?.name === 'string' && typeof entry?.hz === 'number') {
        out[entry.name] = entry.hz
      }
    }
    return out
  }

  if (json.benchmarks && typeof json.benchmarks === 'object') {
    const out = {}
    for (const [name, hz] of Object.entries(json.benchmarks)) {
      if (typeof name === 'string' && typeof hz === 'number') {
        out[name] = hz
      }
    }
    return out
  }

  return {}
}

const baselineRaw = JSON.parse(readFileSync(baselinePath, 'utf8'))
const currentRaw = JSON.parse(readFileSync(currentPath, 'utf8'))

const baseline = extractMap(baselineRaw)
const current = extractMap(currentRaw)

const missing = []
const regressions = []
const summary = []

for (const [name, baseHz] of Object.entries(baseline)) {
  const latestHz = current[name]
  if (typeof latestHz !== 'number') {
    missing.push(name)
    continue
  }
  const ratio = latestHz / baseHz
  summary.push({ name, baseHz, latestHz, ratio })
  if (ratio < 1 - tolerance) {
    regressions.push({ name, baseHz, latestHz, ratio })
  }
}

if (missing.length > 0) {
  console.error('Missing benchmarks in current run:', missing.join(', '))
}

for (const entry of summary) {
  const delta = ((entry.ratio - 1) * 100).toFixed(2)
  const status = entry.ratio >= 1 ? 'faster' : 'slower'
  console.log(
    `${entry.name}: ${entry.latestHz.toFixed(2)} hz (${delta}% ${status} vs ${entry.baseHz.toFixed(2)} hz)`
  )
}

if (regressions.length > 0 || missing.length > 0) {
  if (regressions.length > 0) {
    console.error('\nBenchmarks below threshold (tolerance', tolerance, '):')
    for (const entry of regressions) {
      const drop = ((1 - entry.ratio) * 100).toFixed(2)
      console.error(
        ` - ${entry.name}: ${entry.latestHz.toFixed(2)} hz (${drop}% slower than baseline)`
      )
    }
  }
  process.exit(1)
}
