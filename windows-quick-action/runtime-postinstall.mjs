#!/usr/bin/env node
/**
 * runtime-postinstall.mjs (Windows)
 *
 * Idempotent patches for the shared Slidev runtime when it lives outside the
 * markdown folder (%LOCALAPPDATA%\Slidev\runtime).
 *
 * Patches Vite's `server.fs.allow` to honor SLIDEV_EXTRA_FS_ALLOW.
 * On Windows the delimiter is `;` (PATH-style) so drive letters like `C:`
 * are not split incorrectly. `|` is also accepted as an explicit separator.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const RUNTIME = process.env.SLIDEV_RUNTIME
  || join(HERE, '..', 'runtime')

const PATCH_MARK = '/* slidev-open:SLIDEV_EXTRA_FS_ALLOW */'
const NEEDLE = '\t\t\t\t\t\t...options.roots\n\t\t\t\t\t])'
// Split on `;` or `|` — never bare `:` — so Windows `C:\...` paths stay intact.
const REPLACEMENT = `\t\t\t\t\t\t...options.roots,
\t\t\t\t\t\t...(process.env.SLIDEV_EXTRA_FS_ALLOW || '').split(/[;|]/).filter(Boolean) ${PATCH_MARK}
\t\t\t\t\t])`

let touched = 0
let skipped = 0
let missed = 0

function patchCliDist() {
  const dir = join(RUNTIME, 'node_modules', '@slidev', 'cli', 'dist')
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    console.error(`[postinstall] cli dist not found: ${dir}`)
    process.exitCode = 1
    return
  }

  const targets = entries.filter(name => name.endsWith('.mjs'))
  let foundConfig = false
  for (const name of targets) {
    const file = join(dir, name)
    const source = readFileSync(file, 'utf8')
    if (source.includes(PATCH_MARK)) {
      foundConfig = true
      skipped++
      continue
    }
    if (!source.includes(NEEDLE))
      continue

    foundConfig = true
    writeFileSync(file, source.replace(NEEDLE, REPLACEMENT))
    touched++
  }

  if (!foundConfig) {
    missed++
    console.error('[postinstall] Vite fs.allow pattern not found (Slidev CLI layout changed?)')
    process.exitCode = 1
  }
}
patchCliDist()

if (touched) console.log(`[postinstall] patched ${touched} file(s)`)
if (skipped) console.log(`[postinstall] already patched (${skipped})`)
if (missed)  console.log(`[postinstall] needle missed in ${missed} file(s)`)
