#!/usr/bin/env node
// Builds src/styles/tokens.css from the Figma Variables export.
// See docs/DESIGN_SYSTEM.md and docs/decisions/ADR-010-design-system-tooling.md.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const tokensJsonPath = resolve(root, 'docs/design/tokens/figma-tokens.json')
const manualCssPath = resolve(root, 'src/styles/tokens.manual.css')
const outputPath = resolve(root, 'src/styles/tokens.css')

function flattenTokens(node, prefix = []) {
  const lines = []
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue
    const path = [...prefix, key]
    if (child && typeof child === 'object' && '$value' in child) {
      lines.push(`  --${path.join('-')}: ${formatValue(child.$value, child.$type)};`)
    } else if (child && typeof child === 'object') {
      lines.push(...flattenTokens(child, path))
    }
  }
  return lines
}

function formatValue(value, type) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (type === 'fontFamily' && /\s/.test(entry) ? `'${entry}'` : entry))
      .join(', ')
  }
  return String(value)
}

function indentDeclarations(css) {
  return css
    .split('\n')
    .map((line) => (line.trim() ? `  ${line.trim()}` : ''))
    .filter(Boolean)
    .join('\n')
}

function main() {
  if (!existsSync(tokensJsonPath)) {
    console.error(
      `Missing ${tokensJsonPath}.\nExport Figma Variables as W3C Design Tokens (DTCG) JSON and save it there, then rerun "pnpm design:tokens".`,
    )
    process.exit(1)
  }

  const tokens = JSON.parse(readFileSync(tokensJsonPath, 'utf8'))
  const tokenLines = flattenTokens(tokens)
  const manualCss = existsSync(manualCssPath) ? readFileSync(manualCssPath, 'utf8').trim() : ''

  const body = [manualCss ? indentDeclarations(manualCss) : '', tokenLines.join('\n')]
    .filter(Boolean)
    .join('\n')

  const output = `/* GENERATED FILE — do not edit by hand.
 * Source: docs/design/tokens/figma-tokens.json (+ src/styles/tokens.manual.css for values Figma cannot express)
 * Rebuild with: pnpm design:tokens
 * See docs/DESIGN_SYSTEM.md and docs/decisions/ADR-010-design-system-tooling.md
 */
:root {
${body}
}
`

  writeFileSync(outputPath, output)
  console.log(`Wrote ${outputPath} from ${tokenLines.length} tokens.`)
}

main()
