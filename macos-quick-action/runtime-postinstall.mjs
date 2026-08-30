#!/usr/bin/env node
/**
 * runtime-postinstall.mjs
 *
 * Idempotent patches applied to the shared Slidev runtime so that the bundled
 * features keep working when the runtime lives in a directory that is NOT a
 * parent of the user's markdown (i.e. ~/Library/Application Support/Slidev).
 *
 * Currently patches:
 *
 * 1. `@slidev/cli/dist/shared-*.mjs`
 *    Extends Vite's `server.fs.allow` with paths from the
 *    `SLIDEV_EXTRA_FS_ALLOW` environment variable (colon-separated).
 *
 *    Without this patch, indirect Slidev dependencies such as
 *      runtime/node_modules/@shikijs/vscode-textmate
 *      runtime/node_modules/monaco-editor
 *      runtime/node_modules/shiki
 *    are blocked by Vite's strict fs.allow filter when the markdown lives
 *    outside the runtime tree, and Slidev's built-in editor / Monaco code
 *    blocks fail to load with messages like
 *      "The request id ... is outside of Vite serving allow list."
 *
 * Re-run this script whenever the runtime is freshly installed or upgraded.
 * It is safe (and cheap, ~5 ms) to run on every launch.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const RUNTIME = process.env.SLIDEV_RUNTIME
  || join(HERE, '..', 'runtime')

const PATCH_MARK = '/* slidev-open:SLIDEV_EXTRA_FS_ALLOW */'
const NEEDLE = '\t\t\t\t\t\t...options.roots\n\t\t\t\t\t])'
const REPLACEMENT = `\t\t\t\t\t\t...options.roots,
\t\t\t\t\t\t...(process.env.SLIDEV_EXTRA_FS_ALLOW || '').split(':').filter(Boolean) ${PATCH_MARK}
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

  // Slidev <=52.15 used shared-*.mjs; newer releases put this config in
  // serve-*.mjs. Search all top-level chunks so future filename changes do
  // not unnecessarily break a fresh-machine install.
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
