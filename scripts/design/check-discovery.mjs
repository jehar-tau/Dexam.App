#!/usr/bin/env node
// Checks the approved contract without generating or overwriting any stylesheet.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8')
const contract = JSON.parse(read('docs/design/discovery.tokens.json'))
const css = read('src/styles/discovery.css')
const entry = read('src/styles/tokens.css')
assert.match(entry, /@import '\.\/discovery\.css'/)
assert.doesNotMatch(entry, /design-system\/(colors|typography|effects)\.css/)
const [lightCss, darkCss] = css.split("[data-theme='dark']")
assert.ok(darkCss, 'A dark theme must be provided')
const declarations = (source) =>
  Object.fromEntries(
    [...source.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
  )
const light = declarations(lightCss)
const dark = { ...light, ...declarations(darkCss.split('@media')[0]) }
for (const [key, value] of Object.entries(contract.colors))
  assert.equal(light[key], value, `Approved color drift: ${key}`)
assert.ok(light['--font-sans'].includes(contract.fonts.sans))
assert.ok(light['--font-serif'].includes(contract.fonts.serif))

function resolve(tokens, name, seen = new Set()) {
  assert.ok(!seen.has(name), `Circular token: ${name}`)
  seen.add(name)
  const value = tokens[name]
  assert.ok(value, `Missing token: ${name}`)
  const reference = /^var\((--[\w-]+)\)$/.exec(value)
  return reference ? resolve(tokens, reference[1], seen) : value
}
function luminance(hex) {
  assert.match(hex, /^#[\da-f]{6}$/i)
  const channels = [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
const pairs = [
  ...['--bg-page', '--surface-card', '--surface-muted'].flatMap((background) =>
    ['--text-body', '--text-secondary', '--text-muted', '--text-link'].map((foreground) => [
      foreground,
      background,
      4.5,
    ]),
  ),
  ['--text-on-primary', '--accent-primary', 4.5],
  ...['success', 'warning', 'danger', 'info'].map((status) => [
    `--color-${status}`,
    `--color-${status}-soft`,
    4.5,
  ]),
  ['--border-strong', '--surface-card', 3],
  ['--color-focus-ring', '--bg-page', 3],
]
for (const [theme, tokens] of Object.entries({ light, dark })) {
  for (const [foreground, background, threshold] of pairs) {
    const values = [foreground, background].map((name) => luminance(resolve(tokens, name)))
    const ratio = (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05)
    assert.ok(
      ratio >= threshold,
      `${theme}: ${foreground} on ${background}: ${ratio.toFixed(2)} < ${threshold}`,
    )
  }
}
console.log(
  `${contract.name} ${contract.version}: approved primitives, fonts, active imports and ${pairs.length * 2} light/dark contrast pairs passed.`,
)
