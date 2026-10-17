import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { assertBrowserBundleBudget } from './browser-bundle-budget.mjs'

const directory = join(process.cwd(), 'dist', 'assets')
const chunks = readdirSync(directory)
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({ name, bytes: statSync(join(directory, name)).size }))
assertBrowserBundleBudget(chunks)
console.log(`Browser bundle budget passed: ${chunks.length} JavaScript chunks, each <= 500 KB.`)
