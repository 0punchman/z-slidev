#!/usr/bin/env node
/**
 * Ensure runtime\.pnpm\slidev.mjs exists.
 *
 * Slidev treats an entry path containing ".pnpm" as a globally-installed CLI,
 * so themes/addons resolve from the shared runtime's node_modules even when
 * the markdown folder has no package.json.
 *
 * Prefer a symlink; fall back to a tiny re-export wrapper (no admin needed).
 */
import { existsSync, mkdirSync, symlinkSync, writeFileSync, lstatSync, unlinkSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const runtime = process.env.SLIDEV_RUNTIME
if (!runtime) {
  console.error('ensure-pnpm-entry: SLIDEV_RUNTIME is required')
  process.exit(1)
}

const cliReal = join(runtime, 'node_modules', '@slidev', 'cli', 'bin', 'slidev.mjs')
const cliEntry = join(runtime, '.pnpm', 'slidev.mjs')

if (!existsSync(cliReal)) {
  console.error(`ensure-pnpm-entry: missing CLI at ${cliReal}`)
  process.exit(1)
}

mkdirSync(dirname(cliEntry), { recursive: true })

if (existsSync(cliEntry)) {
  try {
    const st = lstatSync(cliEntry)
    if (st.isSymbolicLink() || st.isFile()) {
      process.exit(0)
    }
  } catch { /* recreate below */ }
  try { unlinkSync(cliEntry) } catch { /* ignore */ }
}

try {
  // Relative symlink keeps the runtime portable across user profile moves.
  symlinkSync(relative(dirname(cliEntry), cliReal), cliEntry)
} catch {
  const absUrl = pathToFileURL(cliReal).href
  writeFileSync(cliEntry, `await import(${JSON.stringify(absUrl)})\n`, 'utf8')
}
