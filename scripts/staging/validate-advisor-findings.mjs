import { readFile } from 'node:fs/promises'

const reportPath = process.argv[2]

if (!reportPath) {
  throw new Error('Pass the Supabase advisor JSON file to validate')
}

const report = JSON.parse(await readFile(reportPath, 'utf8'))
const findings = report.results

if (!Array.isArray(findings)) {
  throw new Error('The Supabase advisor report does not contain a results array')
}

const blockingNames = new Set([
  'anon_security_definer_function_executable',
  'auth_allow_anonymous_sign_ins',
  'function_search_path_mutable',
  'policy_exists_rls_disabled',
  'rls_disabled_in_public',
])

const blockingFindings = findings.filter(
  (finding) => finding.level === 'ERROR' || blockingNames.has(finding.name),
)

const counts = new Map()
for (const finding of findings) {
  const key = `${finding.level}:${finding.name}`
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

for (const [key, count] of [...counts.entries()].sort(([left], [right]) =>
  left.localeCompare(right),
)) {
  console.log(`${key}=${count}`)
}

if (blockingFindings.length > 0) {
  const summary = blockingFindings.map(({ level, name }) => `${level}:${name}`).join(', ')
  throw new Error(`Blocking Supabase advisor findings detected: ${summary}`)
}

console.log(`Supabase advisor gate passed (${findings.length} recorded findings).`)
