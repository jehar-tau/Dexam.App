/**
 * F038 bank import (operator only).
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm assessment:import \
 *     --file dexam-bank-export.json --media <media root> [--dry-run] [--report report.json]
 *
 * Limited to a local Supabase stack until staging import is approved. A dry run writes nothing.
 */
import { createHash } from 'node:crypto'
import { lstat, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { createClient } from '@supabase/supabase-js'

import { bankExport } from './exportSchema.ts'
import {
  planImport,
  type ExistingQuestion,
  type MediaCheck,
  type PlannedQuestion,
} from './planImport.ts'

const MAX_BYTES = 5 * 1024 * 1024
const BUCKET = 'assessment-media'

const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    media: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    report: { type: 'string' },
  },
})

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!values.file || !values.media) fail('Usage: --file <export.json> --media <media root>')
if (!url || !serviceKey) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  fail('Imports are limited to a local Supabase stack until staging import is approved.')
}

const mediaRoot = path.resolve(values.media)

function sniffMime(bytes: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp'
  return null
}

const extensionFor = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const

type CheckedMedia = { check: MediaCheck; bytes?: Buffer }

async function checkMedia(relative: string, expectedSha: string): Promise<CheckedMedia> {
  const absolute = path.resolve(mediaRoot, relative)
  const inside = path.relative(mediaRoot, absolute)
  if (inside.startsWith('..') || path.isAbsolute(inside)) {
    return { check: { ok: false, reason: 'media-missing' } }
  }
  try {
    const stat = await lstat(absolute)
    if (!stat.isFile()) return { check: { ok: false, reason: 'media-missing' } }
    if (stat.size > MAX_BYTES) return { check: { ok: false, reason: 'media-too-large' } }
    const bytes = await readFile(absolute)
    if (createHash('sha256').update(bytes).digest('hex') !== expectedSha) {
      return { check: { ok: false, reason: 'media-mismatch' } }
    }
    const mime = sniffMime(bytes)
    const extension = path.extname(relative).slice(1).toLowerCase().replace('jpeg', 'jpg')
    if (!mime || extensionFor[mime] !== extension) {
      return { check: { ok: false, reason: 'media-type' } }
    }
    return { check: { ok: true, mime, bytes: bytes.length }, bytes }
  } catch {
    return { check: { ok: false, reason: 'media-missing' } }
  }
}

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await work(items[next++])
    }),
  )
}

const raw = await readFile(values.file)
const digest = createHash('sha256').update(raw).digest('hex')
const parsed = bankExport.safeParse(JSON.parse(raw.toString('utf8')))
if (!parsed.success) {
  fail(
    `The export does not match schema v1:\n${parsed.error.issues
      .slice(0, 10)
      .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')}`,
  )
}
const bank = parsed.data

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const existing = new Map<string, ExistingQuestion>()
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from('assessment_questions')
    .select('id, external_key, version, content_hash')
    .neq('publication_state', 'retired')
    .order('external_key')
    .range(from, from + 999)
  if (error) fail(`Could not read the current bank: ${error.message}`)
  const rows = data as {
    id: string
    external_key: string
    version: number
    content_hash: string
  }[]
  for (const row of rows) {
    existing.set(row.external_key, {
      id: row.id,
      version: row.version,
      contentHash: row.content_hash,
    })
  }
  if (rows.length < 1000) break
}

const media = new Map<string, MediaCheck>()
const mediaBytes = new Map<string, Buffer>()
const assets = bank.questions.flatMap((question) => question.assets)
await pool(assets, 16, async (asset) => {
  if (media.has(asset.path)) return
  const result = await checkMedia(asset.path, asset.sha256)
  media.set(asset.path, result.check)
  if (result.bytes) mediaBytes.set(asset.path, result.bytes)
})

const plan = planImport(bank, existing, media)

const papers = new Map<string, { ready: number; objective: number }>()
for (const item of plan.items) {
  if (item.kind === 'descriptive') continue
  const paper = papers.get(item.question.provenance.paperId) ?? { ready: 0, objective: 0 }
  paper.objective += 1
  if (item.state === 'ready') paper.ready += 1
  papers.set(item.question.provenance.paperId, paper)
}

console.log(`Export ${digest.slice(0, 12)}… · ${bank.questions.length} questions`)
console.table(plan.counts)
console.table(Object.fromEntries(Object.entries(plan.reasons).sort(([, a], [, b]) => b - a)))

const report = {
  exportDigest: digest,
  dryRun: values['dry-run'],
  counts: plan.counts,
  reasons: plan.reasons,
  papers: Object.fromEntries([...papers].sort(([a], [b]) => a.localeCompare(b))),
  quarantined: plan.items
    .filter((item) => item.state === 'quarantined')
    .map((item) => ({ externalKey: item.question.externalKey, reasons: item.reasons })),
}
if (values.report) await writeFile(values.report, JSON.stringify(report, null, 2))

if (values['dry-run']) {
  console.log('Dry run: nothing was written.')
  process.exit(0)
}

const run = await supabase
  .from('assessment_import_runs')
  .insert({ export_digest: digest, actor: process.env.USER ?? 'operator', counts: plan.counts })
  .select('id')
  .single()
if (run.error) fail(`Could not record the import run: ${run.error.message}`)

const storagePath = (sha: string, mime: keyof typeof extensionFor) =>
  `${sha.slice(0, 2)}/${sha}.${extensionFor[mime]}`

const failures: { externalKey: string; message: string }[] = []

async function writeQuestion(item: PlannedQuestion) {
  const question = item.question
  const payloadAssets: {
    role: string
    storagePath: string
    sha256: string
    width: number | null
    height: number | null
    mimeType: string
    position: number
  }[] = []
  for (const [position, asset] of question.assets.entries()) {
    const check = media.get(asset.path)
    if (!check?.ok) continue // A quarantined question keeps its record without the bad file.
    const target = storagePath(asset.sha256, check.mime)
    // Content-addressed and immutable: an existing object is the same file. Retry gateway hiccups.
    for (let attempt = 1; ; attempt += 1) {
      const upload = await supabase.storage
        .from(BUCKET)
        .upload(target, mediaBytes.get(asset.path)!, { contentType: check.mime, upsert: false })
      if (!upload.error || /exists|duplicate/i.test(upload.error.message)) break
      if (attempt === 3) throw new Error(`upload ${asset.path}: ${upload.error.message}`)
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
    }
    payloadAssets.push({
      role: asset.role,
      storagePath: target,
      sha256: asset.sha256,
      width: asset.width ?? null,
      height: asset.height ?? null,
      mimeType: check.mime,
      position,
    })
  }
  const { error } = await supabase.rpc('assessment_import_question', {
    p_question: {
      externalKey: question.externalKey,
      version: item.version,
      previousId: item.action === 'new-version' ? existing.get(question.externalKey)!.id : null,
      contentHash: item.contentHash,
      type: item.kind,
      prompt: question.prompt,
      topic: question.topic ?? null,
      subtopic: question.subtopic ?? null,
      difficulty: question.difficulty,
      estimatedSeconds: question.estimatedSeconds ?? null,
      visualDependency: question.visualDependency,
      responseMode: item.kind === 'descriptive' ? 'upload' : 'auto',
      state: item.state,
      reasons: item.reasons,
      licence: question.licence,
      sourceKind: question.sourceKind,
      assets: payloadAssets,
      // Option images are only linked when their file made it into the bank.
      options: item.options
        // Duplicate letters only occur on questions already quarantined as options-invalid.
        .filter(
          (option, index, all) => all.findIndex((other) => other.key === option.key) === index,
        )
        .map((option) => ({
          ...option,
          assetIndex:
            option.assetIndex !== null && media.get(question.assets[option.assetIndex].path)?.ok
              ? payloadAssets.findIndex((asset) => asset.position === option.assetIndex)
              : null,
        })),
      key: item.answer
        ? {
            answer: item.answer,
            status: question.answer!.status,
            explanation: question.explanation ?? null,
            explanationStatus: question.explanation ? 'verified' : 'pending',
          }
        : null,
      provenance: question.provenance,
    },
  })
  if (error) throw new Error(error.message)
}

// D-060: display mode and task marks live beside the imported version.
async function writePresentation(item: PlannedQuestion) {
  const { display, taskMarks } = item.question
  const update = await supabase
    .from('assessment_questions')
    .update({ display_mode: display, task_marks: taskMarks ?? null })
    .eq('external_key', item.question.externalKey)
    .eq('version', item.version)
  if (update.error) throw new Error(`presentation: ${update.error.message}`)
}

const writes = plan.items.filter((item) => item.action !== 'unchanged')
let done = 0
await pool(writes, 8, async (item) => {
  try {
    await writeQuestion(item)
    await writePresentation(item)
  } catch (error) {
    failures.push({ externalKey: item.question.externalKey, message: String(error) })
  }
  done += 1
  if (done % 250 === 0) console.log(`… ${done}/${writes.length}`)
})

// Unchanged questions may still need their presentation set (first run after D-060).
const presentation = plan.items.filter(
  (item) =>
    item.action === 'unchanged' && (item.question.display === 'block' || item.question.taskMarks),
)
await pool(presentation, 8, async (item) => {
  try {
    await writePresentation(item)
  } catch (error) {
    failures.push({ externalKey: item.question.externalKey, message: String(error) })
  }
})

await supabase
  .from('assessment_import_runs')
  .update({
    counts: { ...plan.counts, failed: failures.length },
    report: { reasons: plan.reasons, failures: failures.slice(0, 200) },
    finished_at: new Date().toISOString(),
  })
  .eq('id', run.data.id)

console.log(`Wrote ${writes.length - failures.length} of ${writes.length} changed questions.`)
if (failures.length) {
  console.error(failures.slice(0, 20))
  process.exit(1)
}
