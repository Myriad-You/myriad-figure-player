import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Every name each entry gives out, values and types alike. A change here is a change to the
// public surface: make it on purpose, in fixtures/entries.json, and say so in the release.
const ENTRIES = { '.': 'index.ts', './contract': 'contract.ts', './internals': 'internals.ts', './workbench': 'workbench.ts' } as const

test('each entry exports exactly the names on record', () => {
  const files = Object.fromEntries(Object.entries(ENTRIES).map(([entry, file]) => [entry, fileURLToPath(new URL(file, import.meta.url))]))
  const program = ts.createProgram(Object.values(files), {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    resolveJsonModule: true,
    noEmit: true,
  })
  const checker = program.getTypeChecker()
  const exported = Object.fromEntries(Object.entries(files).map(([entry, file]) => {
    const module = checker.getSymbolAtLocation(program.getSourceFile(file)!)!
    return [entry, checker.getExportsOfModule(module).map(symbol => symbol.name).toSorted()]
  }))
  const recorded = JSON.parse(readFileSync(new URL('fixtures/entries.json', import.meta.url), 'utf8'))
  assert.deepEqual(exported, recorded)
})
